/* Minimal static server for ppms-landing/ — Python is not installed on this
   machine, so this stands in for `python3 -m http.server`. */
const http = require("http");
const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "ppms-landing");
const PORT = process.env.PORT || 8081;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".ico":  "image/x-icon",
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(ROOT, url === "/" ? "index.html" : url);

  // keep requests inside ROOT
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("404 Not Found");
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    // Range support so <video> can seek during scroll-scrubbing
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [s, e] = range.replace("bytes=", "").split("-");
      const start = parseInt(s, 10) || 0;
      const end = e ? parseInt(e, 10) : st.size - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${st.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes" });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`PPMS landing → http://localhost:${PORT}`));
