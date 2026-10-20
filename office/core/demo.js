/*
 * 데모 시나리오 — 실제 Claude Code 기록과 같은 모양의 jsonl 레코드를 시간에 맞춰 만들어 낸다.
 * 서버 --demo 모드는 이걸 임시 폴더의 .jsonl 파일에 써서 tail 경로를 그대로 타고,
 * 정적 페이지(GitHub Pages)는 브라우저 안에서 바로 상태 엔진에 넣는다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OfficeDemo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var HOME = "/Users/donghwan/work";
  var PROJECTS = [
    { key: "-Users-donghwan-work-kleague-data-lab", cwd: HOME + "/kleague-data-lab", script: dataLab },
    { key: "-Users-donghwan-work-slack-alert-bot", cwd: HOME + "/slack-alert-bot", script: alertBot },
    { key: "-Users-donghwan-work-portfolio", cwd: HOME + "/portfolio", script: portfolio }
  ];

  function uid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  }

  function Writer(project, emit) {
    this.p = project; this.emit = emit; this.sid = uid(); this.n = 0;
  }
  Writer.prototype.rec = function (o) {
    o.sessionId = this.sid; o.cwd = this.p.cwd; o.timestamp = new Date().toISOString(); o.uuid = uid();
    this.emit(this.p.key, this.sid, o);
  };
  Writer.prototype.user = function (text) { this.rec({ type: "user", message: { role: "user", content: text } }); };
  Writer.prototype.title = function (t) { this.emit(this.p.key, this.sid, { type: "ai-title", aiTitle: t, sessionId: this.sid }); };
  Writer.prototype.think = function (t) { this.rec({ type: "assistant", message: { role: "assistant", content: [{ type: "thinking", thinking: t }] } }); };
  Writer.prototype.say = function (t, end) { this.rec({ type: "assistant", message: { role: "assistant", stop_reason: end ? "end_turn" : null, content: [{ type: "text", text: t }] } }); };
  Writer.prototype.tool = function (name, input) {
    var id = "toolu_" + (++this.n) + Math.random().toString(36).slice(2, 8);
    this.rec({ type: "assistant", message: { role: "assistant", stop_reason: "tool_use", content: [{ type: "tool_use", id: id, name: name, input: input }] } });
    return id;
  };
  Writer.prototype.result = function (id, text, err) {
    this.rec({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: text, is_error: !!err }] } });
  };
  Writer.prototype.clear = function () {
    this.sid = uid();
    this.rec({ type: "user", isMeta: true, message: { role: "user", content: "<command-name>/clear</command-name>" } });
  };

  // 각 시나리오는 [대기ms, 함수] 목록. 함수는 w(Writer)와 이전 툴 id를 담는 ctx를 받는다.
  function dataLab() {
    return [
      [600, function (w) { w.title("xG 모델 블록 교차검증"); w.user("학습에 안 쓴 라운드로만 xG 모델 성적 다시 내줘"); }],
      [1200, function (w) { w.think("먼저 기존 평가 코드에서 어떤 라운드가 학습에 섞였는지 확인해야겠다"); }],
      [2200, function (w, c) { c.a = w.tool("Grep", { pattern: "train_test_split", path: "src/" }); }],
      [1600, function (w, c) { w.result(c.a, "src/eval.py:42"); c.b = w.tool("Read", { file_path: HOME + "/kleague-data-lab/src/eval.py" }); }],
      [1800, function (w, c) { w.result(c.b, "..."); w.think("무작위 분할이라 같은 경기 슈팅이 양쪽에 들어간다. 라운드 단위 블록으로 바꾸자"); }],
      [2400, function (w, c) { c.t = w.tool("TodoWrite", { todos: [
        { content: "라운드 단위 블록 분할로 교체", status: "in_progress" },
        { content: "부트스트랩 신뢰구간 추가", status: "pending" },
        { content: "검증 리포트 표 갱신", status: "pending" } ] }); }],
      [1200, function (w, c) { w.result(c.t, "ok"); c.e = w.tool("Edit", { file_path: HOME + "/kleague-data-lab/src/eval.py", old_string: "x", new_string:
        "from sklearn.model_selection import GroupKFold\n\ndef block_cv(df, model, k=5):\n    groups = df[\"round\"]\n    scores = []\n    for tr, te in GroupKFold(k).split(df, groups=groups):\n        model.fit(df.iloc[tr][FEATS], df.iloc[tr].goal)\n        p = model.predict_proba(df.iloc[te][FEATS])[:, 1]\n        scores.append(brier(df.iloc[te].goal, p))\n    return np.mean(scores), np.std(scores)" }); }],
      [3200, function (w, c) { w.result(c.e, "ok"); c.x = w.tool("Bash", { command: "python -m pytest tests/test_eval.py -q" }); }],
      [3600, function (w, c) { w.result(c.x, "FAILED tests/test_eval.py::test_block_cv - KeyError: 'round'", true); }],
      [2200, function (w) { w.think("테스트 픽스처에 round 컬럼이 없다. 픽스처를 고치자"); }],
      [1800, function (w, c) { c.e2 = w.tool("Edit", { file_path: HOME + "/kleague-data-lab/tests/conftest.py", old_string: "x", new_string:
        "@pytest.fixture\ndef shots():\n    df = pd.read_parquet(FIXTURE)\n    df[\"round\"] = df.match_id.map(ROUND_OF)\n    return df" }); }],
      [2400, function (w, c) { w.result(c.e2, "ok"); c.x2 = w.tool("Bash", { command: "python -m pytest tests/ -q" }); }],
      [3800, function (w, c) { w.result(c.x2, "14 passed in 3.2s"); c.t2 = w.tool("TodoWrite", { todos: [
        { content: "라운드 단위 블록 분할로 교체", status: "completed" },
        { content: "부트스트랩 신뢰구간 추가", status: "in_progress" },
        { content: "검증 리포트 표 갱신", status: "pending" } ] }); }],
      [1400, function (w, c) { w.result(c.t2, "ok"); c.g = w.tool("Bash", { command: "git commit -am \"eval: 라운드 블록 교차검증\"" }); }],
      [2200, function (w, c) { w.result(c.g, "[main 3fa1c2e] eval: 라운드 블록 교차검증"); w.say("블록 교차검증으로 바꿨어요. Brier 0.081 → 0.087로 조금 올랐는데, 이게 진짜 실력이에요.", true); }],
      [16000, function () {}]
    ];
  }

  function alertBot() {
    return [
      [2500, function (w) { w.title("모니터링 Slack 알림 규칙"); w.user("경기 시작 30분 전에 기록원 미배정이면 Slack으로 알려줘"); }],
      [1400, function (w) { w.think("일정 DB에서 배정 테이블을 조인해야 한다. 스키마부터 보자"); }],
      [2000, function (w, c) { c.a = w.tool("mcp__postgres__query", { query: "select * from assignments limit 5" }); }],
      [2600, function (w, c) { w.result(c.a, "Error: permission denied for table assignments", true); }],
      [2400, function (w) { w.think("읽기 전용 뷰가 따로 있을 거다. 문서를 찾아보자"); }],
      [1600, function (w, c) { c.s = w.tool("WebSearch", { query: "Slack chat.scheduleMessage rate limit" }); }],
      [2600, function (w, c) { w.result(c.s, "..."); c.q = w.tool("AskUserQuestion", { questions: [{ question: "배정 정보는 v_assign_ro 뷰를 써도 될까요?", options: [{ label: "네, 그 뷰로" }, { label: "다른 테이블" }] }] }); }],
      [7000, function (w, c) { w.result(c.q, "네, 그 뷰로"); c.e = w.tool("Write", { file_path: HOME + "/slack-alert-bot/rules/unassigned.ts", content:
        "export const unassigned = rule({\n  every: \"5m\",\n  sql: `select match_id, kickoff from v_assign_ro\n        where recorder_id is null\n          and kickoff - now() < interval '30 min'`,\n  notify: (rows) => slack.post(\"#기록원-운영\", fmt(rows)),\n  dedupe: (r) => r.match_id,\n});" }); }],
      [3000, function (w, c) { w.result(c.e, "ok"); c.b = w.tool("Bash", { command: "npm run dry-run -- --rule unassigned" }); }],
      [3400, function (w, c) { w.result(c.b, "1 alert would be sent"); c.g = w.tool("Bash", { command: "git push origin feat/unassigned-alert" }); }],
      [2400, function (w, c) { w.result(c.g, "ok"); w.say("미배정 알림 규칙 추가했어요. 같은 경기는 한 번만 보내요.", true); }],
      [20000, function () {}]
    ];
  }

  function portfolio() {
    return [
      [4000, function (w) { w.title("포트폴리오 오피스 페이지"); w.user("포트폴리오에 Claude Code 오피스 데모 링크 달아줘"); }],
      [1500, function (w) { w.think("index.html 작업 섹션 구조를 먼저 읽자"); }],
      [1800, function (w, c) { c.a = w.tool("Read", { file_path: HOME + "/portfolio/index.html" }); }],
      [1600, function (w, c) { w.result(c.a, "..."); c.b = w.tool("Glob", { pattern: "assets/**/*.jpg" }); }],
      [1600, function (w, c) { w.result(c.b, "..."); c.p = w.tool("ExitPlanMode", { plan: "## 계획\n- 작업 섹션에 오피스 카드 추가\n- 데모 GIF 캡처\n- 모바일 레이아웃 확인" }); }],
      [3000, function (w, c) { w.result(c.p, "ok"); c.e = w.tool("Edit", { file_path: HOME + "/portfolio/index.html", old_string: "x", new_string:
        "<article class=\"project\" id=\"p6\">\n  <h3>Claude Code 오피스</h3>\n  <p>세션 기록을 따라 읽어 캐릭터를 움직입니다.</p>\n  <a href=\"office/\">오피스 들어가기</a>\n</article>" }); }],
      [3000, function (w, c) { w.result(c.e, "ok"); c.f = w.tool("WebFetch", { url: "https://dhk03.github.io/portfolio/" }); }],
      [2600, function (w, c) { w.result(c.f, "..."); w.say("카드 추가했어요.", true); }],
      [5000, function (w) { w.clear(); }],
      [1500, function (w) { w.title("모바일 레이아웃 점검"); w.user("모바일에서 카드가 넘치는지 봐줘"); }],
      [1500, function (w) { w.think("375px 폭에서 스크린샷을 찍어 보자"); }],
      [1600, function (w, c) { c.b = w.tool("Bash", { command: "npx playwright screenshot --viewport-size=375,800 index.html m.png" }); }],
      [3400, function (w, c) { w.result(c.b, "ok"); w.say("넘치는 곳 없어요.", true); }],
      [16000, function () {}]
    ];
  }

  /** emit(projectKey, sessionId, record). 반환값으로 stop() */
  function start(emit, opts) {
    opts = opts || {};
    var speed = opts.speed || 1, timers = [], stopped = false;
    PROJECTS.forEach(function (p) {
      var w = new Writer(p, emit);
      (function loop() {
        var steps = p.script(), ctx = {}, i = 0;
        (function next() {
          if (stopped) return;
          if (i >= steps.length) { w.clear(); return loop(); }
          var st = steps[i++];
          timers.push(setTimeout(function () { st[1](w, ctx); next(); }, st[0] / speed));
        })();
      })();
    });
    return function stop() { stopped = true; timers.forEach(clearTimeout); };
  }

  return { start: start, PROJECTS: PROJECTS };
});
