#!/usr/bin/env node
/*
 * Claude Code 상태줄 — 터미널 아래 한 줄에 "클로드 동환이 지금 어느 방에 있는지"를 보여준다.
 *
 *   node statusline.js --install     # ~/.claude/settings.json 에 상태줄로 등록(기존 설정은 백업)
 *   node statusline.js --uninstall   # 등록 해제
 *
 * Claude Code가 세션 정보(JSON)를 stdin으로 넘겨주면, 그 세션의 기록(jsonl)을 직접 읽어
 * 오피스와 같은 규칙(core/state.js)으로 상태를 계산한다. 서버가 꺼져 있어도 동작하고,
 * 서버가 켜져 있으면 몇 층인지도 붙인다.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var os = require("os");
var http = require("http");
var OfficeCore = require("./core/state.js");

var PORT = +(process.env.OFFICE_PORT || process.env.PORT || 4317);
var TAIL_BYTES = 512 * 1024;
var SETTINGS = path.join(os.homedir(), ".claude", "settings.json");
var CONFIG = process.env.OFFICE_CONFIG || path.join(__dirname, "office.config.json");
var SELF = __filename.replace(/\\/g, "/"); // Windows에서도 bash·cmd 모두 읽히게 슬래시로

var C = {
  dim: "\x1b[2m", reset: "\x1b[0m", bold: "\x1b[1m",
  gold: "\x1b[38;5;220m", green: "\x1b[38;5;78m", blue: "\x1b[38;5;111m",
  yellow: "\x1b[38;5;214m", red: "\x1b[38;5;203m", gray: "\x1b[38;5;245m", orange: "\x1b[38;5;209m"
};
var ROOM_ICON = { library: "📚", dev: "💻", server: "🗄️", search: "🌐", meeting: "🗒️", desk: "🧑‍💻", lounge: "☕" };

if (process.argv.indexOf("--install") >= 0) install();
else if (process.argv.indexOf("--uninstall") >= 0) uninstall();
else run();

// ---------- 상태줄 ----------
function run() {
  var buf = "", done = false;
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", function (d) { buf += d; });
  process.stdin.on("end", function () { finish(); });
  setTimeout(finish, 1500); // stdin이 안 닫혀도 멈추지 않게
  function finish() {
    if (done) return; done = true;
    var input = {};
    try { input = JSON.parse(buf || "{}"); } catch (e) { /* 빈 입력이면 기본 문구 */ }
    render(input, function (line) { process.stdout.write(line + "\n"); process.exit(0); });
  }
}

function render(input, cb) {
  var tp = input.transcript_path;
  var cwd = (input.workspace && (input.workspace.project_dir || input.workspace.current_dir)) || input.cwd || "";
  var project = path.basename(cwd) || "";
  if (!tp || !fs.existsSync(tp)) return cb(C.gold + "🏢 DH 타워" + C.reset + C.dim + " │ " + C.reset + "☕ 라운지에서 대기 중");

  var sid = input.session_id || path.basename(tp, ".jsonl");
  var pkey = path.basename(path.dirname(tp));
  var office = new OfficeCore.Office({ maxAge: Infinity });
  readTail(tp).forEach(function (line) {
    try { office.ingest(pkey, sid, JSON.parse(line), true); } catch (e) { /* 깨진 줄은 건너뜀 */ }
  });
  office.tick();
  var p = office.projects[pkey], s = p && p.sessions[sid];
  if (p && p.cwd && !project) project = path.basename(p.cwd);
  var cfg = OfficeCore.matchFloor(readConfig(), { cwd: (p && p.cwd) || cwd, name: project, key: pkey });
  if (cfg && cfg.name) project = cfg.name;
  var tag = cfg && cfg.tag ? " " + C.bold + "[" + cfg.tag + "]" + C.reset : "";

  floorOf(sid, function (floor) {
    var parts = [C.gold + C.bold + "🏢 " + (floor ? floor + "F " : "") + C.reset + C.gold + (project || "DH 타워") + C.reset + tag];
    parts.push(s ? describe(s) : "☕ 라운지에서 대기 중");
    if (s && s.plan && s.plan.length) {
      var done = s.plan.filter(function (t) { return t.status === "completed"; }).length;
      parts.push(C.gray + "🗒️ 작전판 " + done + "/" + s.plan.length + C.reset);
    }
    if (s && s.fails) parts.push(C.red + "💦 실패 " + s.fails + C.reset);
    cb(parts.join(C.dim + " │ " + C.reset));
  });
}

function describe(s) {
  var room = OfficeCore.ROOMS[s.room] || OfficeCore.ROOMS.lounge;
  var where = (ROOM_ICON[s.room] || "☕") + " " + room.label;
  var who = C.orange + "클로드 동환" + C.reset;
  switch (s.status) {
    case "running": {
      var t = s.tool || {}, name = String(t.name || "").replace(/^mcp__/, "");
      var detail = t.detail ? " " + clip(t.detail, 40) : "";
      return C.green + "● " + C.reset + where + C.gray + " · " + C.reset + who + " " + name + C.gray + detail + C.reset;
    }
    case "thinking": return C.blue + "💭 " + C.reset + where + C.gray + " · " + C.reset + who + C.blue + " 생각 중" + C.reset;
    case "asking": return C.yellow + "🙋 " + C.reset + who + C.yellow + "이 내 자리로 질문하러 왔어요" + C.reset;
    case "error": return C.red + "💦 " + C.reset + where + C.gray + " · " + C.reset + C.red + clip(s.lastError ? s.lastError.text : "실패", 50) + C.reset;
    default: return C.gray + "☕ 라운지 · " + C.reset + who + C.gray + " 쉬는 중" + C.reset;
  }
}

function readTail(file) {
  var st = fs.statSync(file), start = Math.max(0, st.size - TAIL_BYTES);
  var fd = fs.openSync(file, "r"), buf = Buffer.alloc(st.size - start);
  try { fs.readSync(fd, buf, 0, buf.length, start); } finally { fs.closeSync(fd); }
  var lines = buf.toString("utf8").split("\n");
  if (start > 0) lines.shift(); // 잘린 첫 줄
  return lines.filter(function (l) { return l.trim(); });
}

// 오피스 서버가 켜져 있으면 몇 층인지 물어본다(0.2초 안에 답이 없으면 생략)
function floorOf(sid, cb) {
  var called = false;
  function once(v) { if (!called) { called = true; cb(v); } }
  var req = http.get({ host: "127.0.0.1", port: PORT, path: "/state", timeout: 200 }, function (res) {
    var body = "";
    res.on("data", function (d) { body += d; });
    res.on("end", function () {
      try {
        var f = JSON.parse(body).floors.filter(function (f) { return f.sessions.some(function (x) { return x.id === sid; }); })[0];
        once(f ? f.floor : null);
      } catch (e) { once(null); }
    });
  });
  req.on("timeout", function () { req.destroy(); once(null); });
  req.on("error", function () { once(null); });
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")).floors || []; } catch (e) { return []; }
}

function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// ---------- 설치 ----------
function readSettings() {
  if (!fs.existsSync(SETTINGS)) return {};
  try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); }
  catch (e) { console.error("⚠️  " + SETTINGS + " 를 읽을 수 없어요(JSON 오류). 손으로 고친 뒤 다시 실행해 주세요."); process.exit(1); }
}
function install() {
  var s = readSettings();
  var cmd = 'node "' + SELF + '"';
  if (s.statusLine && s.statusLine.command === cmd) { console.log("✅ 이미 등록돼 있어요."); return; }
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  if (fs.existsSync(SETTINGS)) {
    var bak = SETTINGS + ".bak-office";
    fs.copyFileSync(SETTINGS, bak);
    console.log("🗂️  기존 설정 백업: " + bak);
  }
  if (s.statusLine) console.log("ℹ️  원래 상태줄(" + JSON.stringify(s.statusLine.command || s.statusLine) + ")을 바꿉니다. 되돌리려면 --uninstall");
  s.statusLine = { type: "command", command: cmd, padding: 0 };
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + "\n");
  console.log("✅ 상태줄 등록 완료: " + SETTINGS);
  console.log("   Claude Code를 새로 열면 아래쪽에 오피스 상태가 보여요.");
}
function uninstall() {
  var s = readSettings();
  if (!s.statusLine || String(s.statusLine.command || "").indexOf("statusline.js") < 0) { console.log("ℹ️  오피스 상태줄이 등록돼 있지 않아요."); return; }
  var bak = SETTINGS + ".bak-office", prev = null;
  try { prev = JSON.parse(fs.readFileSync(bak, "utf8")).statusLine; } catch (e) { /* 백업 없음 */ }
  if (prev && String(prev.command || "").indexOf("statusline.js") < 0) s.statusLine = prev; else delete s.statusLine;
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + "\n");
  console.log("✅ 상태줄 해제" + (prev ? " (원래 상태줄로 되돌림)" : ""));
}
