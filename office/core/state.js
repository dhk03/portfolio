/*
 * 오피스 상태 엔진 — Claude Code 세션 기록(jsonl) 한 줄씩 받아 사무실 상태로 바꾼다.
 * 서버(Node)와 브라우저(데모 모드)에서 같은 코드를 쓴다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OfficeCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ROOMS = {
    library: { label: "자료실", icon: "📚" },
    dev: { label: "개발실", icon: "💻" },
    server: { label: "서버실", icon: "🗄️" },
    search: { label: "정보검색실", icon: "🌐" },
    meeting: { label: "회의실", icon: "🗒️" },
    desk: { label: "내 자리", icon: "🧑‍💻" },
    lounge: { label: "라운지", icon: "☕" }
  };

  var LIBRARY = /^(Read|Grep|Glob|LS|NotebookRead)$/;
  var DEV = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
  var SERVER = /^(Bash|BashOutput|KillShell|KillBash|Monitor|TaskStop)$/;
  var SEARCH = /^(WebSearch|WebFetch|ToolSearch|ListMcpResourcesTool|ReadMcpResourceTool)$/;
  var MEETING = /^(TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet|EnterPlanMode|ExitPlanMode|Agent|Task|Skill)$/;
  var ASK = /^(AskUserQuestion)$/;

  var WORKING_WINDOW = 20000; // 마지막 기록 후 이 시간 안이면 아직 일하는 중
  var ERROR_WINDOW = 5000;
  var STALE_TOOL = 10 * 60 * 1000;

  function roomFor(name) {
    if (ASK.test(name)) return "desk";
    if (LIBRARY.test(name)) return "library";
    if (DEV.test(name)) return "dev";
    if (SERVER.test(name)) return "server";
    if (SEARCH.test(name) || /^mcp__/.test(name)) return "search";
    if (MEETING.test(name)) return "meeting";
    return "server";
  }

  function clip(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  function base(p) {
    p = String(p || "").replace(/[\\/]+$/, "");
    return p.slice(Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\")) + 1) || p;
  }
  function firstLine(s) {
    s = String(s || "").trim();
    var i = s.indexOf("\n");
    return i < 0 ? s : s.slice(0, i);
  }
  function resultText(c) {
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map(function (x) { return x && x.text ? x.text : ""; }).join("\n");
    return "";
  }
  function toolDetail(name, input) {
    input = input || {};
    if (input.file_path) return base(input.file_path);
    if (input.notebook_path) return base(input.notebook_path);
    if (input.command) return clip(input.command, 70);
    if (input.pattern) return clip(input.pattern, 50);
    if (input.query) return clip(input.query, 60);
    if (input.url) return clip(input.url.replace(/^https?:\/\//, ""), 60);
    if (input.description) return clip(input.description, 60);
    if (input.subject) return clip(input.subject, 60);
    if (input.skill) return clip(input.skill, 40);
    if (/^mcp__/.test(name)) return name.split("__").slice(1).join(" · ");
    return "";
  }
  function codeLines(name, input) {
    var src = input.new_string || input.content || input.new_source || "";
    if (!src && Array.isArray(input.edits)) src = input.edits.map(function (e) { return e.new_string; }).join("\n");
    return String(src).split("\n").filter(function (l) { return l.trim(); }).slice(0, 40).map(function (l) { return l.slice(0, 80); });
  }
  function planFromMarkdown(md) {
    return String(md || "").split("\n").map(function (l) { return l.trim(); })
      .filter(function (l) { return /^([-*]|\d+[.)]|#{1,3})\s+/.test(l); })
      .map(function (l) { return { text: clip(l.replace(/^([-*]|\d+[.)]|#{1,3})\s+/, "").replace(/\*\*/g, ""), 60), status: "pending" }; })
      .slice(0, 8);
  }
  function isGit(cmd) { return /(^|[;&|]\s*|\s)git\s/.test(" " + (cmd || "")); }

  function Office(opts) {
    opts = opts || {};
    this.projects = {};
    this.maxAge = opts.maxAge || 3 * 24 * 3600 * 1000;
    this.perFloor = opts.perFloor || 8;
    this.onFx = opts.onFx || function () {};
    this.now = opts.now || function () { return Date.now(); };
    this.floorConfig = opts.floors || [];
    this.version = 0;
  }

  /*
   * 층 설정(office.config.json의 floors) — 프로젝트를 이름 붙인 층으로 연결한다.
   *   { "match": "sports-data-portal", "name": "sports2i 데이터 포털", "tag": "ADMIN", "floor": 5, "link": "http://localhost:8000" }
   * match는 프로젝트 폴더 이름(또는 그 일부, 배열 가능)이다. 설정한 층은 세션이 없어도 안내판에 남는다.
   */
  function matchFloor(config, p) {
    var keys = [base(p.cwd), p.name, p.key].filter(Boolean).map(function (v) { return String(v).toLowerCase(); });
    for (var i = 0; i < (config || []).length; i++) {
      var c = config[i], ms = [].concat(c.match || []);
      for (var j = 0; j < ms.length; j++) {
        var m = String(ms[j]).toLowerCase();
        if (m && keys.some(function (k) { return k === m || k.indexOf(m) >= 0; })) return c;
      }
    }
    return null;
  }

  Office.prototype.session = function (pkey, sid) {
    var p = this.projects[pkey];
    if (!p) {
      p = this.projects[pkey] = { key: pkey, name: decodeProjectKey(pkey), cwd: "", sessions: {}, firstTs: Infinity };
    }
    var s = p.sessions[sid];
    if (!s) {
      s = p.sessions[sid] = {
        id: sid, project: pkey, title: "", prompt: "", createdTs: 0, lastTs: 0,
        pending: {}, lastError: null, thought: "", say: "", question: null,
        plan: [], code: [], file: "", query: "", command: "", git: false,
        stats: { library: 0, dev: 0, server: 0, search: 0, meeting: 0, desk: 0 },
        tools: 0, fails: 0, turnEnded: true, sub: 0, status: "idle", room: "lounge"
      };
    }
    return s;
  };

  /** 기록 한 줄 반영. replay=true면 과거 기록을 다시 읽는 중이라 효과(말풍선)를 내지 않는다. */
  Office.prototype.ingest = function (pkey, sid, rec, replay) {
    if (!rec || typeof rec !== "object") return;
    var s = this.session(pkey, sid);
    var p = this.projects[pkey];
    var ts = rec.timestamp ? Date.parse(rec.timestamp) : 0;
    var self = this;
    function fx(kind, text, extra) {
      if (replay) return;
      var e = { sid: s.id, project: pkey, kind: kind, text: text, room: s.room, ts: ts || self.now() };
      if (extra) for (var k in extra) e[k] = extra[k];
      self.onFx(e);
    }

    if (rec.cwd && !p.cwd) { p.cwd = rec.cwd; p.name = base(rec.cwd); }
    if (ts) {
      if (!s.createdTs) s.createdTs = ts;
      if (ts > s.lastTs) s.lastTs = ts;
      if (ts < p.firstTs) p.firstTs = ts;
    }
    this.version++;

    if (rec.type === "ai-title" && rec.aiTitle) { s.title = clip(rec.aiTitle, 40); return; }
    if (rec.type === "summary" && rec.summary && !s.title) { s.title = clip(rec.summary, 40); return; }
    if (rec.type === "custom-title" && rec.customTitle) { s.title = clip(rec.customTitle, 40); return; }
    if (rec.type !== "user" && rec.type !== "assistant") return;

    var msg = rec.message || {};
    var content = msg.content;
    var sub = !!rec.isSidechain;

    if (rec.type === "user") {
      if (typeof content === "string") {
        if (rec.isMeta || /^\s*<(command-|local-command|system-reminder)/.test(content)) return;
        s.prompt = clip(content, 120);
        if (!s.title) s.title = clip(content, 28);
        s.turnEnded = false; s.question = null; s.say = "";
        fx("prompt", clip(content, 80));
        return;
      }
      if (!Array.isArray(content)) return;
      content.forEach(function (b) {
        if (!b) return;
        if (b.type === "text" && !sub && !/^\s*</.test(b.text || "")) {
          if (/\[Request interrupted/.test(b.text)) { s.pending = {}; s.turnEnded = true; fx("say", "작업이 중단됐어요"); return; }
          s.prompt = clip(b.text, 120); s.turnEnded = false; s.question = null;
          fx("prompt", clip(b.text, 80));
        }
        if (b.type !== "tool_result") return;
        var t = s.pending[b.tool_use_id];
        delete s.pending[b.tool_use_id];
        if (t && t.name === "AskUserQuestion") s.question = null;
        var txt = resultText(b.content);
        var failed = b.is_error === true || /^<tool_use_error>/.test(txt);
        if (failed) {
          s.fails++;
          var why = clip(firstLine(txt.replace(/<\/?tool_use_error>/g, "")), 90) || "실패";
          s.lastError = { text: why, ts: ts || self.now(), room: t ? t.room : s.room, tool: t ? t.name : "" };
          fx("fail", why, { room: t ? t.room : s.room, tool: t ? t.name : "" });
        }
      });
      return;
    }

    // assistant
    if (!Array.isArray(content)) return;
    s.turnEnded = false;
    content.forEach(function (b) {
      if (!b) return;
      if (b.type === "thinking" || b.type === "redacted_thinking") {
        var th = clip(firstLine(b.thinking || "").replace(/^[#*\s]+/, ""), 70);
        s.thought = th || "흠… 생각 중";
        fx("think", s.thought, { sub: sub });
      } else if (b.type === "text" && b.text && b.text.trim()) {
        if (!sub) { s.say = clip(b.text, 140); fx("say", clip(b.text, 90)); }
      } else if (b.type === "tool_use") {
        var name = b.name || "?", input = b.input || {};
        var room = roomFor(name);
        var detail = toolDetail(name, input);
        s.pending[b.id] = { name: name, room: room, detail: detail, since: ts || self.now(), sub: sub };
        s.tools++;
        s.stats[room] = (s.stats[room] || 0) + 1;
        if (sub) s.sub++;
        if (room === "library") s.file = detail;
        if (room === "dev") { s.file = detail; var cl = codeLines(name, input); if (cl.length) s.code = cl; }
        if (room === "server") { s.command = detail; s.git = isGit(input.command); }
        if (room === "search") s.query = detail;
        if (name === "TodoWrite" && Array.isArray(input.todos)) {
          s.plan = input.todos.slice(0, 8).map(function (t) { return { text: clip(t.content || t.subject || "", 60), status: t.status || "pending" }; });
        } else if (name === "TaskCreate" && input.subject) {
          s.plan = s.plan.concat([{ text: clip(input.subject, 60), status: "pending" }]).slice(-8);
        } else if (name === "TaskUpdate" && input.status && input.subject) {
          s.plan.forEach(function (it) { if (it.text === clip(input.subject, 60)) it.status = input.status; });
        } else if (name === "ExitPlanMode" && input.plan) {
          var pl = planFromMarkdown(input.plan);
          if (pl.length) s.plan = pl;
        }
        if (name === "AskUserQuestion") {
          var q = (input.questions && input.questions[0]) || {};
          s.question = { text: clip(q.question || input.question || "확인해 주세요", 100), options: (q.options || []).slice(0, 4).map(function (o) { return clip(o.label || o, 24); }) };
        }
        fx("tool", detail ? name.replace(/^mcp__/, "") + " · " + detail : name.replace(/^mcp__/, ""), { room: room, tool: name, sub: sub });
      }
    });
    if (msg.stop_reason === "end_turn" && !sub) { s.turnEnded = true; fx("done", s.say || "다 했어요"); }
  };

  /** 시간이 흐르며 바뀌는 상태(일하는 중 → 쉬는 중 등) 계산 */
  Office.prototype.tick = function () {
    var now = this.now(), changed = false;
    for (var pk in this.projects) {
      var p = this.projects[pk];
      for (var sk in p.sessions) {
        var s = p.sessions[sk];
        for (var id in s.pending) if (now - s.pending[id].since > STALE_TOOL) { delete s.pending[id]; }
        var tools = Object.keys(s.pending).map(function (k) { return s.pending[k]; });
        var main = tools.filter(function (t) { return !t.sub; });
        var cur = (main.length ? main : tools).sort(function (a, b) { return b.since - a.since; })[0] || null;
        var status, room;
        if (s.question || (cur && cur.name === "AskUserQuestion")) { status = "asking"; room = "desk"; }
        else if (s.lastError && now - s.lastError.ts < ERROR_WINDOW) { status = "error"; room = s.lastError.room || s.room; }
        else if (cur) { status = "running"; room = cur.room; }
        else if (!s.turnEnded && now - s.lastTs < WORKING_WINDOW) { status = "thinking"; room = s.room === "lounge" ? "meeting" : s.room; }
        else { status = "idle"; room = "lounge"; }
        var tool = cur ? { name: cur.name, detail: cur.detail, room: cur.room, since: cur.since } : null;
        var key = status + "|" + room + "|" + (tool ? tool.name + tool.detail : "") + "|" + tools.length;
        if (key !== s._key) { s._key = key; s.status = status; s.room = room; s.tool = tool; s.running = tools.length; changed = true; }
      }
    }
    return changed;
  };

  Office.prototype.snapshot = function () {
    var now = this.now(), self = this;
    var projects = Object.keys(this.projects).map(function (k) { return self.projects[k]; });
    var used = [];
    var floors = projects.map(function (p) {
      var sessions = Object.keys(p.sessions).map(function (k) { return p.sessions[k]; })
        .filter(function (s) { return s.lastTs && now - s.lastTs < self.maxAge; })
        .sort(function (a, b) { return b.lastTs - a.lastTs; })
        .slice(0, self.perFloor);
      var cfg = matchFloor(self.floorConfig, p);
      if (cfg && sessions.length) used.push(cfg);
      return { p: p, sessions: sessions, cfg: cfg };
    }).filter(function (f) { return f.sessions.length; });
    // 설정했지만 아직 세션이 없는 층은 '입점 준비 중'으로 남긴다
    self.floorConfig.forEach(function (c) {
      if (used.indexOf(c) >= 0 || c.keep === false) return;
      var m = [].concat(c.match || [])[0] || "floor";
      floors.push({ p: { key: "cfg:" + m, name: m, cwd: "", firstTs: Infinity }, sessions: [], cfg: c });
    });
    floors.sort(function (a, b) { return a.p.firstTs - b.p.firstTs || (a.p.name < b.p.name ? -1 : 1); });
    // 층 번호: 설정에서 정한 번호를 먼저 쓰고, 나머지는 빈 번호를 아래부터 채운다
    var taken = {};
    floors.forEach(function (f) { if (f.cfg && f.cfg.floor > 0 && !taken[f.cfg.floor]) { f.n = f.cfg.floor; taken[f.n] = true; } });
    var next = 1;
    floors.forEach(function (f) { if (f.n) return; while (taken[next]) next++; f.n = next; taken[next] = true; });
    floors.sort(function (a, b) { return a.n - b.n; });
    return {
      now: now,
      floors: floors.map(function (f) {
        var c = f.cfg || {};
        return {
          key: f.p.key, name: c.name || f.p.name, cwd: f.p.cwd, floor: f.n, tag: c.tag || "", link: c.link || "",
          live: f.sessions.length ? f.sessions[0].id : null,
          empty: !f.sessions.length,
          active: f.sessions.some(function (s) { return s.status !== "idle"; }),
          sessions: f.sessions.map(publicSession)
        };
      })
    };
  };

  function publicSession(s) {
    return {
      id: s.id, title: s.title || "새 세션", prompt: s.prompt, status: s.status, room: s.room, tool: s.tool,
      running: s.running || 0, createdTs: s.createdTs, lastTs: s.lastTs, thought: s.thought, say: s.say,
      question: s.question, plan: s.plan, code: s.code, file: s.file, query: s.query, command: s.command,
      git: s.git, stats: s.stats, tools: s.tools, fails: s.fails, sub: s.sub,
      lastError: s.lastError
    };
  }

  // ~/.claude/projects 폴더 이름은 경로의 / 를 - 로 바꾼 것
  function decodeProjectKey(k) {
    var parts = String(k).split("-").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : k;
  }

  return { Office: Office, ROOMS: ROOMS, roomFor: roomFor, matchFloor: matchFloor };
});
