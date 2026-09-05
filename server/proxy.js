import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns/promises";
import { validatePublicUrl } from "./guard.js";

// Recheck every connection (including redirects), then connect to the checked IP.
// Passing the hostname to connect() would allow DNS rebinding after validation.
async function destination(value) {
  let addresses;
  const url = new URL(
    await validatePublicUrl(value, async (host, options) => {
      addresses = await lookup(host, options);
      return addresses;
    }),
  );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return { url, address: addresses?.[0].address ?? host };
}

export function createPublicProxy() {
  const server = http.createServer(async (req, res) => {
    try {
      const { url, address } = await destination(req.url);
      if (url.protocol !== "http:") throw new Error("Use CONNECT for HTTPS");
      if (res.destroyed) return;
      const headers = { ...req.headers, host: url.host, connection: "close" };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const upstream = http.request(
        {
          hostname: address,
          port: url.port || 80,
          method: req.method,
          path: url.pathname + url.search,
          headers,
          timeout: 20_000,
        },
        (reply) => {
          res.writeHead(reply.statusCode, reply.headers);
          reply.on("error", () => res.destroy());
          reply.pipe(res);
        },
      );
      upstream.on("timeout", () => upstream.destroy());
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      res.on("close", () => upstream.destroy());
      req.pipe(upstream);
    } catch {
      res.writeHead(403).end("Destination blocked");
    }
  });
  server.on("connect", async (req, client, head) => {
    client.on("error", () => client.destroy());
    try {
      const { url, address } = await destination(`https://${req.url}`);
      if (client.destroyed) return;
      const upstream = net.connect({ host: address, port: Number(url.port || 443) });
      upstream.setTimeout(20_000, () => upstream.destroy());
      upstream.on("error", () => client.destroy());
      upstream.on("close", () => client.destroy());
      client.on("close", () => upstream.destroy());
      upstream.on("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  });
  return server;
}

let proxyUrl;
export function getProxyUrl() {
  proxyUrl ??= new Promise((resolve, reject) => {
    const server = createPublicProxy();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.unref();
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
  return proxyUrl;
}
