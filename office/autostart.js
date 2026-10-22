#!/usr/bin/env node
/*
 * 윈도우에 로그인하면 오피스 서버가 창 없이 저절로 켜지게 한다.
 *
 *   node autostart.js --install     # 시작프로그램 폴더에 등록하고 지금 바로 켬
 *   node autostart.js --uninstall   # 등록 해제
 *   node autostart.js --status      # 등록·실행 상태 확인
 *
 * 시작프로그램 폴더(%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup)에
 * 작은 VBScript 하나를 둔다. 이 스크립트가 node server.js --log office.log 를 창 없이 실행한다.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var http = require("http");
var cp = require("child_process");

var PORT = +(process.env.PORT || 4317);
var NAME = "DH-Tower-Office.vbs";
var DIR = __dirname;
var STARTUP = process.env.OFFICE_STARTUP_DIR ||
  path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
var VBS = path.join(STARTUP, NAME);
var LOG = path.join(DIR, "office.log");

var cmd = process.argv[2];
if (cmd === "--install") install();
else if (cmd === "--uninstall") uninstall();
else if (cmd === "--status") status();
else {
  console.log("사용법: node autostart.js --install | --uninstall | --status");
  process.exit(1);
}

function windowsOnly() {
  if (process.platform === "win32" || process.env.OFFICE_STARTUP_DIR) return true;
  console.log("ℹ️  자동 시작 등록은 윈도우용이에요. 맥·리눅스에서는 로그인 항목이나 systemd에 'node " + path.join(DIR, "server.js") + "' 를 등록해 주세요.");
  return false;
}

// VBScript 문자열 안의 " 는 "" 로 쓴다
function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

function vbsSource() {
  // 0 = 창 숨김, False = 끝날 때까지 기다리지 않음
  var run = q(process.execPath) + " " + q(path.join(DIR, "server.js")) + " --log " + q(LOG);
  return [
    "' DH 타워 오피스 자동 시작 — node autostart.js --uninstall 로 지울 수 있어요",
    'Set sh = CreateObject("WScript.Shell")',
    "sh.CurrentDirectory = " + q(DIR),
    "sh.Run " + q(run) + ", 0, False",
    ""
  ].join("\r\n");
}

function install() {
  if (!windowsOnly()) return;
  if (!fs.existsSync(STARTUP)) { console.error("⚠️  시작프로그램 폴더를 찾지 못했어요: " + STARTUP); process.exit(1); }
  // 한글 경로도 읽히도록 UTF-16(BOM 포함)으로 저장 — WSH가 이 형식을 그대로 읽는다
  fs.writeFileSync(VBS, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(vbsSource(), "utf16le")]));
  console.log("✅ 자동 시작 등록: " + VBS);
  console.log("   다음 로그인부터 오피스 서버가 창 없이 켜져요. 출력은 " + LOG + " 에 남아요.");
  alive(function (on) {
    if (on) { console.log("ℹ️  서버가 이미 켜져 있어요 → http://127.0.0.1:" + PORT); return; }
    if (process.platform !== "win32") return;
    cp.spawn("wscript.exe", [VBS], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    setTimeout(function () {
      alive(function (ok) {
        console.log(ok ? "🏢 지금 바로 켰어요 → http://127.0.0.1:" + PORT : "⚠️  아직 응답이 없어요. 잠시 뒤 다시 확인하거나 " + LOG + " 를 봐 주세요.");
      });
    }, 2500);
  });
}

function uninstall() {
  if (!windowsOnly()) return;
  if (fs.existsSync(VBS)) { fs.unlinkSync(VBS); console.log("✅ 자동 시작 해제: " + VBS); }
  else console.log("ℹ️  등록돼 있지 않아요.");
  console.log("   지금 켜져 있는 서버는 다음 로그아웃·재부팅 때 꺼져요. 바로 끄려면 작업 관리자에서 node.exe 를 끝내 주세요.");
}

function status() {
  console.log((fs.existsSync(VBS) ? "✅ 자동 시작 등록됨: " : "❌ 자동 시작 미등록: ") + VBS);
  alive(function (on) { console.log(on ? "🟢 서버 켜짐 → http://127.0.0.1:" + PORT : "⚪ 서버 꺼짐"); });
}

function alive(done) {
  var called = false;
  function cb(v) { if (!called) { called = true; done(v); } }
  var req = http.get({ host: "127.0.0.1", port: PORT, path: "/state", timeout: 800 }, function (res) { res.resume(); cb(res.statusCode === 200); });
  req.on("timeout", function () { req.destroy(); cb(false); });
  req.on("error", function () { cb(false); });
}
