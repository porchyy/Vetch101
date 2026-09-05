export function parseVideoUrl(value: string): string {
  const clean = value.trim();
  if ((clean.split(/[?#]/, 1)[0].match(/https?:\/\//gi) || []).length > 1) {
    throw new Error("พบลิงก์สองอันต่อกัน กรุณาล้างช่องแล้ววางลิงก์วิดีโอเพียงอันเดียว");
  }
  try {
    const url = new URL(clean);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /\s/.test(clean)) {
      throw new Error();
    }
  } catch {
    throw new Error("วางลิงก์วิดีโอที่ขึ้นต้นด้วย https:// หรือ http://");
  }
  return clean;
}
