const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

const server = http.createServer((req, res) => {
  let filePath = path.join(PUBLIC, req.url === "/" ? "index.html" : req.url);
  // パストラバーサル防止
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end(); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  チームカレンダービューアー 起動中`);
  console.log(`  ブラウザで開く: ${url}\n`);
  // OS ごとにブラウザを自動オープン
  const { exec } = require("child_process");
  const cmd =
    process.platform === "win32"  ? `start ${url}` :
    process.platform === "darwin" ? `open ${url}` :
                                     `xdg-open ${url}`;
  exec(cmd);
});
