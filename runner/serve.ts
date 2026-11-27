import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
};

/** Serves a built static site on localhost, the same way for every tool. */
export async function serveSite(dir: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const root = resolve(dir);
  const server: Server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = normalize(join(root, path));
      if (!file.startsWith(root)) throw new Error("outside root");
      const info = await stat(file).catch(() => null);
      const target = info?.isDirectory() ? join(file, "index.html") : file;
      const body = await readFile(target);
      res.writeHead(200, { "content-type": TYPES[extname(target).toLowerCase()] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not start");
  return { origin: `http://127.0.0.1:${address.port}`, close: () => new Promise((done) => server.close(() => done())) };
}
