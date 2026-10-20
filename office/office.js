/* DH 타워 오피스 — 화면 쪽. 서버의 SSE(/events)를 받아 3D 사무실을 움직인다. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var floors = [], clockSkew = 0;
  var cur = { floor: null, sid: null, follow: true };
  var moving = false;

  // ---------- 3D 무대 ----------
  var world = null;
  try { world = Office3D.create($("#stage3d"), $("#overlay")); }
  catch (e) { console.error(e); $("#noscene").classList.add("show"); }
  var W = world || new Proxy({}, { get: function () { return function () { return null; }; } });

  // 소개 카드: 3D 캐릭터를 한 장씩 찍어 쓴다
  $("#crew").innerHTML = ["me", "runner", "archivist", "dev", "server", "scout", "planner"].map(function (k) {
    var r = Characters.ROLES[k], img = "";
    try { img = world ? Characters.snapshot(k, 120) : ""; } catch (e) { /* 없어도 된다 */ }
    return '<li title="' + esc(r.desc) + '"><img alt="" src="' + img + '"><div><b>' + r.name + "</b>" + r.badge + "</div></li>";
  }).join("");

  // ---------- 말풍선 ----------
  var PRIORITY = { fail: 4, ask: 3, order: 2, think: 2, say: 1 };
  function bubble(k, kind, text, ms) {
    var host = W.host(k), b = host && $(".bubble", host);
    if (!b) return;
    var now = Date.now();
    if (b._until > now && (PRIORITY[b._kind] || 0) > (PRIORITY[kind] || 0)) return;
    clearTimeout(b._t);
    b.className = "bubble " + kind + " show";
    b.textContent = text;
    b._kind = kind; b._until = ms ? now + ms : Infinity;
    if (ms) b._t = setTimeout(function () { b.classList.remove("show"); b._until = 0; }, ms);
  }
  function unbubble(k, kind) {
    var host = W.host(k), b = host && $(".bubble", host);
    if (b && b._kind === kind) { b.classList.remove("show"); b._until = 0; }
  }

  // ---------- 엘리베이터 ----------
  function floorObj(key) { return floors.filter(function (f) { return f.key === key; })[0] || null; }
  function setIndicator(arrow, n) {
    $("#elevArrow").textContent = arrow; $("#elevNum").textContent = n + "F";
    $("#elevPanelArrow").textContent = arrow || "●"; $("#elevPanelNum").textContent = n + "F";
    W.setFloor(n, arrow);
  }
  function goFloor(key, sid, follow) {
    var to = floorObj(key);
    if (!to) return;
    var from = floorObj(cur.floor);
    cur.follow = follow;
    if (!from || from.key === key || moving) { cur.floor = key; cur.sid = sid || to.live; render(); return; }
    moving = true;
    var n = from.floor, dir = to.floor > n ? 1 : -1, arrow = dir > 0 ? "▲" : "▼";
    var elev = $("#elevator"), ind = $("#elevInd");
    ind.classList.add("moving");
    setIndicator(arrow, n);
    elev.classList.add("closed");
    setTimeout(function tickFloor() {
      if (n !== to.floor) { n += dir; setIndicator(arrow, n); return setTimeout(tickFloor, 280); }
      cur.floor = key; cur.sid = sid || to.live;
      lastCode = lastPlan = null;
      // 새 층에선 클로드 동환이 엘리베이터에서 내려 일하러 간다
      W.walkTo("lounge", true);
      render();
      setTimeout(function () {
        elev.classList.remove("closed"); ind.classList.remove("moving");
        setIndicator("", to.floor); moving = false;
        W.elevatorDoors(1); setTimeout(function () { W.elevatorDoors(0); }, 1600);
      }, 350);
    }, 550);
  }

  // ---------- 층별 안내 ----------
  var lastDir = "";
  function age(ts) {
    var s = (Date.now() + clockSkew - ts) / 1000;
    if (s < 60) return "방금"; if (s < 3600) return ((s / 60) | 0) + "분"; if (s < 86400) return ((s / 3600) | 0) + "시간";
    return ((s / 86400) | 0) + "일";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function renderDirectory() {
    var html = floors.slice().reverse().map(function (f) {
      var stores = f.sessions.map(function (s) {
        var sel = f.key === cur.floor && s.id === cur.sid;
        return '<li><button class="store' + (sel ? " selected" : "") + '" data-floor="' + esc(f.key) + '" data-sid="' + esc(s.id) + '" title="' + esc(s.prompt || s.title) + '">' +
          '<i class="dot st-' + s.status + '"></i><span class="sname">' + esc(s.title) + "</span>" +
          (s.id === f.live ? '<span class="live-tag">LIVE</span>' : '<span class="age">' + age(s.lastTs) + "</span>") + "</button></li>";
      }).join("");
      return '<li class="floor' + (f.key === cur.floor ? " current" : "") + (f.active ? " active" : "") + '">' +
        '<button class="floor-btn" data-floor="' + esc(f.key) + '"><span class="fl">' + f.floor + 'F</span><span class="fname">' + esc(f.name) +
        "<small>매장 " + f.sessions.length + "곳</small></span><span class=\"lamp\"></span></button>" +
        '<ul class="stores">' + stores + "</ul></li>";
    }).join("") || '<li class="empty-floors">아직 입주한 프로젝트가 없어요.<br>Claude Code를 실행하면 층이 생깁니다.</li>';
    if (html !== lastDir) { $("#floors").innerHTML = html; lastDir = html; }
  }
  $("#floors").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var f = floorObj(b.dataset.floor);
    if (!f) return;
    if (b.classList.contains("store")) goFloor(f.key, b.dataset.sid, b.dataset.sid === f.live);
    else goFloor(f.key, null, true);
  });
  $("#followBtn").addEventListener("click", function () {
    cur.follow = !cur.follow;
    var f = floorObj(cur.floor);
    if (cur.follow && f) cur.sid = f.live;
    render();
  });

  // ---------- 사무실 그리기 ----------
  var STATUS = {
    running: function (s) { return "🏃 " + (s.tool ? s.tool.name.replace(/^mcp__/, "") + (s.tool.detail ? " · " + s.tool.detail : "") : "작업 중"); },
    thinking: function () { return "💭 생각 중"; },
    asking: function () { return "🙋 내 자리로 질문하러 왔어요"; },
    error: function (s) { return "💦 " + (s.lastError ? s.lastError.text : "실패"); },
    idle: function () { return "☕ 쉬는 중"; }
  };
  var lastCode = null, lastPlan = null, lastQ = null, lastCmd = null, lastQuery = null;

  function currentSession() {
    var f = floorObj(cur.floor);
    if (!f) return null;
    var s = f.sessions.filter(function (x) { return x.id === cur.sid; })[0];
    if (!s) { s = f.sessions[0]; cur.sid = s.id; }
    return s;
  }

  function render() {
    renderDirectory();
    var f = floorObj(cur.floor);
    $("#followBtn").classList.toggle("on", cur.follow);
    if (!f) {
      $("#floorName").textContent = "빈 빌딩"; $("#sessionName").textContent = "세션을 기다리는 중";
      W.setRunnerVisible(false); return;
    }
    if (!moving) setIndicator("", f.floor);
    var s = currentSession();
    $("#floorName").textContent = f.floor + "F · " + f.name;
    $("#sessionName").textContent = s.title + (s.prompt ? " — " + s.prompt : "");
    $("#statusPill").textContent = STATUS[s.status](s);
    $("#statusPill").className = "status-pill st-pill-" + s.status;
    W.setRunnerVisible(true);

    var active = s.status === "idle" ? null : s.room;
    W.setActive(active);
    W.setBusy(s.status === "running" && active !== "desk" ? active : null);
    W.setCounts(s.stats);
    W.setFile(s.room === "library" || s.file ? s.file : "");

    var code = (s.file || "") + "\n" + (s.code || []).join("\n");
    if (code !== lastCode) { lastCode = code; W.setCode(s.file, s.code); }
    var cmd = (s.command || "") + (s.git ? "|git" : "");
    if (cmd !== lastCmd || active === "server") { lastCmd = cmd; W.setCommand(s.command, s.git); }
    var q = (s.query || "") + (s.tool && /^mcp__/.test(s.tool.name) ? "|mcp" : "");
    if (q !== lastQuery) { lastQuery = q; W.setQuery(s.query, /\|mcp$/.test(q)); }
    var pl = JSON.stringify(s.plan || []);
    if (pl !== lastPlan) { lastPlan = pl; W.setPlan(s.plan); }

    var asking = s.status === "asking" && s.question;
    var qk = asking ? JSON.stringify(s.question) : "";
    if (qk !== lastQ) { lastQ = qk; W.setQuestion(asking ? s.question : null); }
    if (asking) bubble("runner", "ask", "저기요, 확인 좀 부탁드려요!", 0); else unbubble("runner", "ask");
    if (s.status === "thinking") bubble("runner", "think", s.thought || "흠…", 0); else unbubble("runner", "think");

    W.setRunnerMode(s.status === "idle" ? "idle" : s.status === "thinking" ? "think" : "work");
    W.walkTo(s.status === "idle" ? "lounge" : s.room);
  }

  // ---------- 이벤트 받기 ----------
  var prevLive = {};
  function onSnapshot(snap) {
    clockSkew = snap.now - Date.now();
    floors = snap.floors;
    if (!floorObj(cur.floor)) {
      var pick = floors.filter(function (f) { return f.active; })[0] || floors.slice().sort(function (a, b) { return b.sessions[0].lastTs - a.sessions[0].lastTs; })[0];
      if (pick) { cur.floor = pick.key; cur.sid = pick.live; }
    }
    var f = floorObj(cur.floor);
    if (f && cur.follow && f.live !== cur.sid) {
      if (prevLive[f.key] && prevLive[f.key] !== f.live) toast("🧹 /clear — 같은 층 새 세션으로 따라왔어요");
      cur.sid = f.live;
    }
    floors.forEach(function (x) { prevLive[x.key] = x.live; });
    if (!moving) render(); else renderDirectory();
  }

  var LOG_ICON = { think: "💭", tool: "🔧", fail: "💦", prompt: "🗣️", say: "💬", done: "✅" };
  function onFx(e) {
    if (e.project !== cur.floor) return;
    var f = floorObj(cur.floor);
    var other = e.sid !== cur.sid;
    var li = document.createElement("li");
    li.className = e.kind;
    var t = new Date(e.ts || Date.now());
    var store = other && f ? (f.sessions.filter(function (s) { return s.id === e.sid; })[0] || {}).title : "";
    li.innerHTML = "<time>" + t.toTimeString().slice(0, 8) + "</time>" + (LOG_ICON[e.kind] || "·") + " " + (store ? "[" + esc(store) + "] " : "") +
      (e.kind === "tool" ? "<b>" + esc(roomLabel(e.room)) + "</b> " : "") + esc(e.text);
    var log = $("#log");
    log.insertBefore(li, log.firstChild);
    while (log.children.length > 8) log.removeChild(log.lastChild);
    if (other) return;

    if (e.kind === "think") bubble("runner", "think", e.text, 5000);
    else if (e.kind === "fail") {
      bubble("runner", "fail", e.text, 5000);
      W.sweat("runner", 5000);
      if (e.room && e.room !== "lounge") {
        W.sweat(e.room, 5000);
        W.failFlash(e.room);
        if (e.room !== "desk") bubble(e.room, "fail", "어… 이거 왜 이러지", 4000);
      }
    } else if (e.kind === "prompt") bubble("me", "order", e.text, 6000);
    else if (e.kind === "say") bubble("runner", "say", e.text, 4500);
    else if (e.kind === "done") bubble("runner", "say", "✅ 다 했어요! " + e.text, 6000);
    else if (e.kind === "tool" && e.room && e.room !== "desk" && e.room !== "lounge") bubble(e.room, "say", toolLine(e), 2600);
  }
  function roomLabel(r) { return (OfficeCore.ROOMS[r] || {}).label || r; }
  function toolLine(e) {
    var name = (e.tool || "").replace(/^mcp__/, "");
    var map = { Read: "읽는 중", Grep: "찾는 중", Glob: "목록 보는 중", Edit: "고치는 중", Write: "쓰는 중", Bash: "돌리는 중", WebSearch: "검색 중", WebFetch: "읽어 오는 중", TodoWrite: "작전판 정리", ExitPlanMode: "계획 발표", Agent: "팀원 소집", Task: "팀원 소집" };
    return (map[name] || name) + " 👍";
  }

  var toastT;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------- 연결 ----------
  var params = new URLSearchParams(location.search);
  function setConn(mode, text) { var c = $("#conn"); c.className = "conn " + mode; c.textContent = text; }

  function startDemo() {
    setConn("demo", "데모 모드 · 가상 세션 기록");
    var office = new OfficeCore.Office({ onFx: onFx });
    OfficeDemo.start(function (pk, sid, rec) { office.ingest(pk, sid, rec, false); });
    setInterval(function () { office.tick(); onSnapshot(office.snapshot()); }, 250);
  }

  function connect() {
    if (location.protocol === "file:" || /github\.io$/.test(location.hostname) || params.has("demo") || !window.EventSource) return startDemo();
    var es = new EventSource("events"), hello = false;
    var fallback = setTimeout(function () { if (!hello) { es.close(); startDemo(); } }, 3000);
    es.addEventListener("hello", function (ev) {
      hello = true; clearTimeout(fallback);
      var h = JSON.parse(ev.data);
      setConn(h.mode === "demo" ? "demo" : "live", h.mode === "demo" ? "서버 데모 모드" : "LIVE · " + h.root);
    });
    es.addEventListener("snapshot", function (ev) { onSnapshot(JSON.parse(ev.data)); });
    es.addEventListener("fx", function (ev) { onFx(JSON.parse(ev.data)); });
    es.onerror = function () {
      if (!hello) { clearTimeout(fallback); es.close(); startDemo(); }
      else setConn("", "다시 연결 중…");
    };
  }

  // ---------- 앱으로 설치 (PWA) ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function (e) { console.warn("서비스 워커 등록 실패", e); });
  }
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); installEvt = e; $("#installBtn").hidden = false;
  });
  $("#installBtn").addEventListener("click", function () {
    if (!installEvt) return;
    installEvt.prompt();
    installEvt.userChoice.then(function () { installEvt = null; $("#installBtn").hidden = true; });
  });
  window.addEventListener("appinstalled", function () { $("#installBtn").hidden = true; toast("🏢 DH 오피스 앱을 설치했어요"); });

  setInterval(renderDirectory, 15000);
  connect();
})();
