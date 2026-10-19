/* DH 타워 오피스 — 화면 쪽. 서버의 SSE(/events)를 받아 사무실을 움직인다. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var plan = $("#plan"), wrap = $("#planWrap"), runner = $("#runner");
  var PLAN_W = 976, PLAN_H = 668, scale = 1;

  var floors = [], clockSkew = 0;
  var cur = { floor: null, sid: null, follow: true };
  var moving = false;

  // ---------- 화면 맞추기 ----------
  function fit() {
    scale = Math.min(1, Math.max(.55, wrap.clientWidth / PLAN_W)); // 폰에서는 너무 작아지지 않게 가로로 밀어 보기
    plan.style.transform = "scale(" + scale + ")";
    wrap.style.height = PLAN_H * scale + "px";
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap); else window.addEventListener("resize", fit);
  fit();

  // ---------- 사람과 가구 ----------
  $$(".staff").forEach(function (el) {
    var r = el.dataset.role;
    el.innerHTML = '<div class="bubble"></div><div class="fig">' + Avatars.svg(r) + '</div><div class="nametag">' + Avatars.ROLES[r].name + "</div>";
  });
  $(".fig", runner).innerHTML = Avatars.svg("runner");
  $("#crew").innerHTML = ["me", "runner", "archivist", "dev", "server", "scout", "planner"].map(function (k) {
    var r = Avatars.ROLES[k];
    return "<li>" + Avatars.svg(k) + "<div><b>" + r.name + " <small>· " + r.badge + "</small></b>" + r.desc + "</div></li>";
  }).join("");

  var BOOK = ["#1D5E40", "#E8B21E", "#B03A2E", "#2B5C9E", "#6D4C8C", "#D97757", "#3E7D6A", "#F2EEE3"];
  $("#shelves").innerHTML = [0, 1, 2].map(function (s) {
    return '<div class="shelf">' + [0, 1, 2].map(function () {
      var n = 7 + ((Math.random() * 3) | 0), b = "";
      for (var i = 0; i < n; i++) b += '<b class="' + (Math.random() < .12 ? "pick" : "") + '" style="height:' + (60 + Math.random() * 38) + "%;background:" + BOOK[(Math.random() * BOOK.length) | 0] + ";animation-delay:" + (-Math.random() * 1.2).toFixed(2) + 's"></b>';
      return '<div class="row">' + b + "</div>";
    }).join("") + "</div>";
  }).join("");
  $("#racks").innerHTML = [0, 1, 2].map(function () {
    var u = "";
    for (var i = 0; i < 7; i++) {
      u += '<div class="unit">';
      for (var j = 0; j < 3; j++) {
        var c = Math.random() < .2 ? " amber" : Math.random() < .2 ? " blue" : "";
        u += '<i class="led' + c + '" style="animation-delay:' + (-Math.random() * 2).toFixed(2) + 's"></i>';
      }
      u += "</div>";
    }
    return '<div class="rack">' + u + "</div>";
  }).join("");

  // ---------- 말풍선 ----------
  var PRIORITY = { fail: 4, ask: 3, order: 2, think: 2, say: 1 };
  function bubble(host, kind, text, ms) {
    var b = $(".bubble", host);
    if (!b) return;
    var now = Date.now();
    if (b._until > now && (PRIORITY[b._kind] || 0) > (PRIORITY[kind] || 0)) return;
    clearTimeout(b._t);
    b.className = "bubble " + kind + " show";
    b.textContent = text;
    b._kind = kind; b._until = ms ? now + ms : Infinity;
    if (ms) b._t = setTimeout(function () { b.classList.remove("show"); b._until = 0; }, ms);
  }
  function unbubble(host, kind) {
    var b = $(".bubble", host);
    if (b && b._kind === kind) { b.classList.remove("show"); b._until = 0; }
  }
  function sweat(el, ms) {
    el.classList.add("sweating");
    clearTimeout(el._sw);
    el._sw = setTimeout(function () { el.classList.remove("sweating"); }, ms);
  }

  // ---------- 러너 이동 ----------
  var runnerRoom = null, walkId = 0, runnerPos = null;
  function spotOf(room) {
    var el = $('[data-room="' + room + '"] .spot');
    if (!el) return null;
    var pr = plan.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - pr.left) / scale, y: (r.top - pr.top) / scale };
  }
  function place(p, dur) {
    runner.style.setProperty("--dur", dur + "s");
    if (runnerPos && Math.abs(p.x - runnerPos.x) > 2) runner.classList.toggle("flip", p.x < runnerPos.x);
    runner.style.left = p.x + "px";
    runner.style.top = p.y + "px";
    runnerPos = p;
  }
  function walkTo(room) {
    if (room === runnerRoom) return;
    var target = spotOf(room);
    if (!target) return;
    runnerRoom = room;
    var id = ++walkId;
    if (!runnerPos) { place(target, 0); return; }
    var hall = spotOf("lounge");
    var pts = [];
    var sameRow = Math.abs(runnerPos.y - target.y) < 4 && room !== "lounge";
    if (!sameRow || Math.abs(runnerPos.y - hall.y) < 4) {
      if (Math.abs(runnerPos.y - hall.y) > 4) pts.push({ x: runnerPos.x, y: hall.y });
      if (Math.abs(target.y - hall.y) > 4) pts.push({ x: target.x, y: hall.y });
    } else {
      pts.push({ x: runnerPos.x, y: hall.y }, { x: target.x, y: hall.y });
    }
    pts.push(target);
    runner.classList.add("walking");
    (function step() {
      if (id !== walkId) return;
      var p = pts.shift();
      if (!p) { runner.classList.remove("walking"); if (room === "lounge") kick(); return; }
      var d = Math.hypot(p.x - runnerPos.x, p.y - runnerPos.y);
      var dur = Math.max(.05, d / 300);
      place(p, dur);
      setTimeout(step, dur * 1000);
    })();
  }
  function kick() {
    var g = $(".minigoal");
    g.classList.remove("runner-kick"); void g.offsetWidth; g.classList.add("runner-kick");
  }

  // ---------- 엘리베이터 ----------
  function floorObj(key) { return floors.filter(function (f) { return f.key === key; })[0] || null; }
  function setIndicator(arrow, n) {
    $("#elevArrow").textContent = arrow; $("#elevNum").textContent = n + "F";
    $("#elevPanelArrow").textContent = arrow || "●"; $("#elevPanelNum").textContent = n + "F";
  }
  function goFloor(key, sid, follow) {
    var to = floorObj(key);
    if (!to) return;
    var from = floorObj(cur.floor);
    cur.follow = follow;
    if (!from || from.key === key || moving) {
      cur.floor = key; cur.sid = sid || to.live; render(); return;
    }
    moving = true;
    var n = from.floor, dir = to.floor > n ? 1 : -1, arrow = dir > 0 ? "▲" : "▼";
    var elev = $("#elevator"), ind = $("#elevInd");
    ind.classList.add("moving");
    setIndicator(arrow, n);
    elev.classList.add("closed");
    setTimeout(function tickFloor() {
      if (n !== to.floor) { n += dir; setIndicator(arrow, n); return setTimeout(tickFloor, 260); }
      cur.floor = key; cur.sid = sid || to.live;
      runnerRoom = null; runnerPos = null;
      render();
      setTimeout(function () {
        elev.classList.remove("closed"); ind.classList.remove("moving");
        setIndicator("", to.floor); moving = false;
      }, 300);
    }, 500);
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
  var lastCode = "", lastPlan = "";

  function hl(line) {
    var t = esc(line);
    if (/^\s*(#|\/\/|--)/.test(line)) return '<span class="c">' + t + "</span>";
    return t.replace(/(&quot;.*?&quot;|'[^']*'|`[^`]*`)/g, '<span class="s">$1</span>')
      .replace(/\b(def|return|import|from|export|const|let|var|for|in|if|else|function|class|select|where|and|or|is|null|async|await|new)\b/g, '<span class="k">$1</span>')
      .replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="f">$1</span>');
  }
  function setV(name, v) { $$('[data-v="' + name + '"]').forEach(function (el) { el.textContent = v; }); }

  function render() {
    renderDirectory();
    var f = floorObj(cur.floor);
    $("#followBtn").classList.toggle("on", cur.follow);
    if (!f) {
      $("#floorName").textContent = "빈 빌딩"; $("#sessionName").textContent = "세션을 기다리는 중";
      runner.style.display = "none"; return;
    }
    if (!moving) setIndicator("", f.floor);
    var s = f.sessions.filter(function (x) { return x.id === cur.sid; })[0];
    if (!s) { s = f.sessions[0]; cur.sid = s.id; }
    $("#floorName").textContent = f.floor + "F · " + f.name;
    $("#sessionName").textContent = s.title + (s.prompt ? " — " + s.prompt : "");
    $("#statusPill").textContent = STATUS[s.status](s);
    $("#statusPill").className = "status-pill st-pill-" + s.status;
    runner.style.display = "";

    var active = s.status === "idle" ? null : s.room;
    $$(".room").forEach(function (r) {
      var k = r.dataset.room, on = k === active;
      r.classList.toggle("on", on);
      $(".count", r).textContent = s.stats[k] ? "×" + s.stats[k] : "";
      var st = $(".staff", r);
      if (st && k !== "desk") st.classList.toggle("busy", on && s.status === "running");
    });

    setV("file", s.file || "—");
    setV("devfile", s.file || "untitled");
    setV("command", s.command || "대기 중");
    setV("query", s.query || "무엇이든 찾아드려요");
    $('[data-room="server"]').classList.toggle("git", active === "server" && s.git);
    $('[data-room="search"]').classList.toggle("mcp", !!(s.tool && /^mcp__/.test(s.tool.name)));

    var code = (s.code || []).join("\n");
    if (code !== lastCode) {
      lastCode = code;
      var lines = s.code && s.code.length ? s.code : ["// 아직 고친 코드가 없어요"];
      var items = lines.map(function (l) { return "<li>" + hl(l) + "</li>"; }).join("");
      $("#code").innerHTML = s.code && s.code.length ? items + items : items; // 두 번 이어 붙여 끊김 없이 흐르게
      $("#code").style.setProperty("--scroll", Math.max(3, lines.length * .5) + "s");
    }

    var pl = JSON.stringify(s.plan || []);
    if (pl !== lastPlan) {
      lastPlan = pl;
      $("#plan-items").innerHTML = s.plan && s.plan.length
        ? s.plan.map(function (it, i) { return '<li class="' + esc(it.status) + '" style="animation-delay:' + i * .25 + 's">' + esc(it.text) + "</li>"; }).join("")
        : '<li class="empty">계획이 생기면 여기에 적어요</li>';
    }

    var asking = s.status === "asking" && s.question;
    $("#askCard").classList.toggle("show", !!asking);
    $('[data-room="desk"] .staff').classList.toggle("alert", !!asking);
    if (asking) {
      setV("question", "🙋 " + s.question.text);
      $("#askOpts").innerHTML = s.question.options.map(function (o) { return "<span>" + esc(o) + "</span>"; }).join("");
      bubble(runner, "ask", "저기요, 확인 좀 부탁드려요!", 0);
    } else unbubble(runner, "ask");

    if (s.status === "thinking") bubble(runner, "think", s.thought || "흠…", 0);
    else unbubble(runner, "think");

    runner.classList.toggle("idle", s.status === "idle");
    walkTo(s.status === "idle" ? "lounge" : s.room);
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
    if (f) {
      if (cur.follow && f.live !== cur.sid) {
        if (prevLive[f.key] && prevLive[f.key] !== f.live) toast("🧹 /clear — 같은 층 새 세션으로 따라왔어요");
        cur.sid = f.live;
      }
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

    var room = $('[data-room="' + e.room + '"]');
    if (e.kind === "think") bubble(runner, "think", e.text, 5000);
    else if (e.kind === "fail") {
      bubble(runner, "fail", e.text, 5000);
      sweat(runner, 5000);
      if (room) {
        var st = $(".staff", room);
        if (st) { sweat(st, 5000); bubble(st, "fail", "어… 이거 왜 이러지", 4000); }
        room.classList.add("fail-flash");
        setTimeout(function () { room.classList.remove("fail-flash"); }, 1500);
      }
    } else if (e.kind === "prompt") bubble($('[data-room="desk"] .staff'), "order", e.text, 6000);
    else if (e.kind === "say") bubble(runner, "say", e.text, 4500);
    else if (e.kind === "done") bubble(runner, "say", "다 했어요! " + e.text, 6000);
    else if (e.kind === "tool" && room) {
      var s2 = $(".staff", room);
      if (s2 && e.room !== "desk") bubble(s2, "say", toolLine(e), 2600);
    }
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

  setInterval(renderDirectory, 15000);
  connect();
})();
