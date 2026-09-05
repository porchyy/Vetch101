import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export function createRateLimiter({ limit, windowMs }) {
  const requests = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of requests) {
      if (bucket.resetAt <= now) requests.delete(key);
    }
  }, windowMs);
  cleanup.unref?.();

  return (key) => {
    const now = Date.now();
    const bucket = requests.get(key);
    if (!bucket || bucket.resetAt <= now) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  };
}

export function getAllowedFormat(qualities, requestedId) {
  return qualities.find((quality) => quality.id === requestedId) ?? null;
}

const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
])
  blocked.addSubnet(ip, prefix, "ipv4");
for (const [ip, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
])
  blocked.addSubnet(ip, prefix, "ipv6");

export function isPrivateIp(address) {
  const version = isIP(address);
  return !version || blocked.check(address, version === 4 ? "ipv4" : "ipv6");
}

export async function validatePublicUrl(value, lookupHost = lookup) {
  if (!value || typeof value !== "string") {
    throw new Error("กรุณาระบุ URL วิดีโอ");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("URL ไม่ถูกต้อง กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  ) {
    throw new Error("URL ไม่ถูกต้อง กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || (isIP(host) && isPrivateIp(host))) {
    throw new Error("ไม่อนุญาต URL เครือข่ายภายใน");
  }

  let addresses;
  try {
    addresses = isIP(host) ? [{ address: host }] : await lookupHost(host, { all: true, verbatim: true });
  } catch {
    throw new Error("ไม่สามารถตรวจสอบปลายทางของ URL ได้");
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("ไม่อนุญาต URL เครือข่ายภายใน");
  }
  return url.toString();
}
