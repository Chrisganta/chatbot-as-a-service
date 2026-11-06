// Tiny local reverse proxy: listens on 11435, forwards to Ollama on 11434,
// rewriting the Host header back to localhost so Ollama's built-in
// DNS-rebinding protection doesn't reject requests coming through the
// public ngrok tunnel (which preserves the original public Host header).
// Exists because ngrok's own --host-header=rewrite flag stopped working
// after an agent update (confirmed via direct testing, not just the
// deprecation warning).
const http = require("http");

const TARGET_HOST = "localhost";
const TARGET_PORT = 11434;
const LISTEN_PORT = 11435;

const server = http.createServer((req, res) => {
  const proxyReq = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  req.pipe(proxyReq, { end: true });

  proxyReq.on("error", (err) => {
    res.writeHead(502);
    res.end("Proxy error: " + err.message);
  });
});

server.listen(LISTEN_PORT, () => {
  console.log(`Host-rewrite proxy on :${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});
