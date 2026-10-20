#!/usr/bin/env node
/*
 * Claude Code 오피스 서버
 *  - ~/.claude/projects/**.jsonl 을 0.25초마다 따라 읽고(tail)
 *  - 사무실 상태를 SSE(/events)로 브라우저에 보낸다.
 * 외부 패키지 없이 Node 18+ 표준 모듈만 쓴다.
 *
 *   node office/server.js            # 실제 세션 기록
 *   node office/server.js --demo     # 가짜 세션 기록을 임시 폴더에 쓰면서 시연
 *   PORT=4000 CLAUDE_PROJECTS=/path node office/server.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var http = require("http");
var os = require("os");
var OfficeCore = require("./core/state.js");

var args = process.argv.slice(2);
var DEMO = args.indexOf("--demo") >= 0;
var PORT = +(process.env.PORT || argValue("--port") || 4317);
var HOST = process.env.HOST || argValue("--host") || "127.0.0.1";
var POLL_MS = 250;
var SCAN_MS = 2000;
var MAX_AGE = +(process.env.OFFICE_MAX_AGE_HOURS || 72) * 3600 * 1000;
var BACKLOG_BYTES = 4 * 1024 * 1024; // 처음 붙을 때 파일 끝에서 이만큼만 다시 읽어 상태 복원
var PUBLIC = __dirname;

var ROOT = process.env.CLAUDE_PROJECTS || argValue("--projects") || path.join(os.homedir(), ".claude", "projects");
if (DEMO) ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "claude-office-demo-"));

function argValue(name) {
  var i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

var clients = new Set();
var office = new OfficeCore.Office({ maxAge: MAX_AGE, onFx: function (e) { broadcast("fx", e); } });
var files = new Map(); // 경로 → { offset, partial, pkey, sid }
var dirty = true;

// ---------- tail ----------
function scan() {
  var dirs;
  try { dirs = fs.readdirSync(ROOT, { withFileTypes: true }); } catch (e) { return; }
  var now = Date.now();
  dirs.forEach(function (d) {
    if (!d.isDirectory()) return;
    var dir = path.join(ROOT, d.name), list;
    try { list = fs.readdirSync(dir); } catch (e) { return; }
    list.forEach(function (f) {
      if (!/\.jsonl$/.test(f)) return;
      var fp = path.join(dir, f);
      if (files.has(fp)) return;
      var st;
      try { st = fs.statSync(fp); } catch (e) { return; }
      if (now - st.mtimeMs > MAX_AGE) return; // 오래된 세션은 건너뛴다(수정되면 다음 스캔 때 잡힘)
      var info = { offset: Math.max(0, st.size - BACKLOG_BYTES), partial: "", pkey: d.name, sid: f.replace(/\.jsonl$/, ""), skipFirst: st.size > BACKLOG_BYTES };
      files.set(fp, info);
      read(fp, info, true);
    });
  });
}

function read(fp, info, replay) {
  var st;
  try { st = fs.statSync(fp); } catch (e) { files.delete(fp); return; }
  if (st.size < info.offset) { info.offset = 0; info.partial = ""; } // 파일이 잘렸거나 새로 쓰였다
  if (st.size === info.offset) return;
  var len = st.size - info.offset, buf = Buffer.alloc(len), fd;
  try { fd = fs.openSync(fp, "r"); fs.readSync(fd, buf, 0, len, info.offset); } catch (e) { return; } finally { if (fd !== undefined) fs.closeSync(fd); }
  info.offset = st.size;
  var text = info.partial + buf.toString("utf8");
  var lines = text.split("\n");
  info.partial = lines.pop();
  if (info.skipFirst) { lines.shift(); info.skipFirst = false; }
  lines.forEach(function (line) {
    if (!line.trim()) return;
    var rec;
    try { rec = JSON.parse(line); } catch (e) { return; }
    office.ingest(info.pkey, info.sid, rec, replay);
  });
  dirty = true;
}

function poll() {
  files.forEach(function (info, fp) { read(fp, info, false); });
  if (office.tick()) dirty = true;
  if (dirty) { dirty = false; broadcast("snapshot", office.snapshot()); }
}

// ---------- SSE ----------
function broadcast(event, data) {
  var payload = "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
  clients.forEach(function (res) { res.write(payload); });
}

var MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon" };

var server = http.createServer(function (req, res) {
  var url = new URL(req.url, "http://localhost");
  if (url.pathname === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    res.write("retry: 2000\n");
    res.write("event: hello\ndata: " + JSON.stringify({ mode: DEMO ? "demo" : "live", root: DEMO ? "demo" : ROOT.replace(os.homedir(), "~") }) + "\n\n");
    office.tick();
    res.write("event: snapshot\ndata: " + JSON.stringify(office.snapshot()) + "\n\n");
    clients.add(res);
    req.on("close", function () { clients.delete(res); });
    return;
  }
  if (url.pathname === "/state") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(office.snapshot()));
  }
  var rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  var fp = path.normalize(path.join(PUBLIC, rel));
  if (fp.indexOf(PUBLIC + path.sep) !== 0 || /server\.js$/.test(fp)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, function (err, data) {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

setInterval(function () { clients.forEach(function (res) { res.write(": ping\n\n"); }); }, 15000);
setInterval(scan, SCAN_MS);
setInterval(poll, POLL_MS);
scan();

if (DEMO) {
  // 데모: 시나리오 레코드를 진짜 jsonl 파일에 덧붙인다 → 위의 tail 로직이 그대로 읽어 간다
  require("./core/demo.js").start(function (pkey, sid, rec) {
    var dir = path.join(ROOT, pkey);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, sid + ".jsonl"), JSON.stringify(rec) + "\n");
  });
  process.on("exit", function () { try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (e) {} });
  process.on("SIGINT", function () { process.exit(0); });
}

server.listen(PORT, HOST, function () {
  console.log("🏢 Claude Code 오피스 → http://" + (HOST === "0.0.0.0" ? "localhost" : HOST) + ":" + PORT);
  console.log("   " + (DEMO ? "데모 모드 (" + ROOT + ")" : "세션 기록: " + ROOT));
});
