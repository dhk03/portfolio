/*
 * 오피스 사람들(3D) — 전원 '동환'의 분신이다.
 * 얼굴·머리(BASE)는 같고, 그동안 해 온 일에 맞춰 옷과 소품만 다르다.
 * 생김새를 바꾸고 싶으면 BASE만 고치면 모든 캐릭터에 반영된다.
 */
(function (root) {
  "use strict";
  var T = root.THREE;

  var BASE = {
    skin: "#F3CDAE",
    hair: "#221D1A",
    hairStyle: "side",   // side(옆 가르마) | crop(짧은 크롭) | twoblock(투블럭)
    glasses: false,      // 안경을 쓰면 true
    eyes: "#1B1613"
  };

  // 역할별 인물 설정 — 포트폴리오의 경력·작업에서 가져왔다
  var ROLES = {
    me: {
      name: "김동환", badge: "주장 #10", room: "desk",
      desc: "인천광역시축구협회 → 스포츠투아이 DX사업파트. 이 빌딩의 주인이자 주장.",
      top: "#1D5E40", trim: "#E8B21E", pants: "#F6F3EC", shoes: "#22201E", socks: "#1D5E40", shorts: true
    },
    runner: {
      name: "클로드 동환", badge: "CC #00", room: "lounge",
      desc: "세션마다 한 명. 일이 생기면 그 방으로 뛰어간다.",
      top: "#D97757", trim: "#FFF6EF", pants: "#FFF6EF", shoes: "#3A2A22", socks: "#D97757", shorts: true
    },
    archivist: {
      name: "검수관 동환", badge: "기록 검수", room: "library",
      desc: "K리그 기록원 73명 운영·기록 데이터 검수. 원본과 숫자가 맞는지 먼저 본다.",
      top: "#F7F5EF", trim: "#D4E63A", pants: "#9A8667", shoes: "#3B2F25"
    },
    dev: {
      name: "랩 개발자 동환", badge: "데이터 랩", room: "dev",
      desc: "K리그 데이터 랩·선발 명단 검증 도구. Python, pandas, Three.js.",
      top: "#2F6E4F", trim: "#E8B21E", pants: "#3A3F47", shoes: "#F3F3F3"
    },
    server: {
      name: "현장소장 동환", badge: "DB·자동화", room: "server",
      desc: "PostgreSQL·MSSQL 조회, Slack 정기 알림 스케줄. 오류 연락 3회 → 0건.",
      top: "#2A3A55", trim: "#D8E0EA", pants: "#2A3A55", shoes: "#1C1714"
    },
    scout: {
      name: "전력분석관 동환", badge: "리서치", room: "search",
      desc: "경기 이벤트·일정 데이터 리서치, AI 디자인 스킬 큐레이션.",
      top: "#26418A", trim: "#FFFFFF", pants: "#1C2D5C", shoes: "#F3F3F3"
    },
    planner: {
      name: "기획실장 동환", badge: "제안·계약", room: "meeting",
      desc: "제안서·견적·계약 조율, 스토리보드와 기능 요구사항.",
      top: "#1F2C46", trim: "#E8B21E", pants: "#5C6372", shoes: "#2A1E18", shirt: "#FFFFFF"
    }
  };

  var mats = {};
  function M(color, o) {
    var k = color + JSON.stringify(o || {});
    if (!mats[k]) {
      var p = { color: color, roughness: 0.55, metalness: 0 };
      if (o) for (var x in o) p[x] = o[x];
      mats[k] = new T.MeshStandardMaterial(p);
    }
    return mats[k];
  }
  function add(parent, geo, mat, x, y, z) {
    var m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function rbox(w, h, d, r) { return new T.RoundedBoxGeometry(w, h, d, 3, r == null ? Math.min(w, h, d) * 0.25 : r); }
  function cap(r, len) { return new T.CapsuleGeometry(r, len, 6, 16); }
  function sph(r) { return new T.SphereGeometry(r, 24, 18); }
  function decal(text, color, size, font) {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var x = c.getContext("2d");
    x.fillStyle = color;
    x.font = (font || "800 84px system-ui, sans-serif");
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, 64, 70);
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  }

  function hair(head) {
    var h = BASE.hair, mat = M(h, { roughness: 0.8 });
    var cap1 = add(head, new T.SphereGeometry(0.318, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), mat, 0, 0.02, -0.01);
    cap1.rotation.x = -0.22;
    if (BASE.hairStyle === "crop") return;
    if (BASE.hairStyle === "twoblock") {
      var top = add(head, sph(0.2), mat, 0, 0.24, 0.06); top.scale.set(1.45, 0.55, 1.35);
      return;
    }
    // 옆 가르마: 앞머리가 한쪽으로 쓸린 덩어리
    var f = add(head, sph(0.16), mat, -0.07, 0.19, 0.19); f.scale.set(1.5, 0.55, 0.75); f.rotation.z = 0.25;
    var f2 = add(head, sph(0.12), mat, 0.15, 0.2, 0.15); f2.scale.set(1.1, 0.5, 0.8); f2.rotation.z = -0.35;
  }

  function face(head) {
    var eye = M(BASE.eyes, { roughness: 0.3 });
    [-0.105, 0.105].forEach(function (x) {
      var e = add(head, sph(0.04), eye, x, -0.01, 0.27); e.scale.set(1, 1.2, 0.6);
      add(head, sph(0.012), M("#ffffff", { roughness: 0.2 }), x + 0.012, 0.012, 0.296);
      var b = add(head, rbox(0.09, 0.018, 0.02, 0.008), M(BASE.hair), x, 0.085, 0.27); b.rotation.z = x < 0 ? 0.12 : -0.12;
      var ck = add(head, new T.CircleGeometry(0.045, 20), M("#F29A88", { transparent: true, opacity: 0.45 }), x * 1.55, -0.075, 0.262);
      ck.rotation.y = x < 0 ? -0.5 : 0.5; ck.castShadow = false;
    });
    var mouth = add(head, new T.TorusGeometry(0.04, 0.011, 8, 16, Math.PI), M("#8A3B2E"), 0, -0.09, 0.27);
    mouth.rotation.z = Math.PI;
    var nose = add(head, sph(0.025), M("#E9B897"), 0, -0.04, 0.29);
    nose.castShadow = false;
    if (BASE.glasses) {
      var gm = M("#1B1613", { metalness: 0.4, roughness: 0.3 });
      [-0.105, 0.105].forEach(function (x) { add(head, new T.TorusGeometry(0.07, 0.01, 8, 24), gm, x, -0.01, 0.285); });
      add(head, rbox(0.06, 0.012, 0.012, 0.004), gm, 0, 0, 0.29);
    }
  }

  function build(key) {
    var r = ROLES[key];
    var g = new T.Group();
    var body = new T.Group(); g.add(body);
    var skin = M(BASE.skin), top = M(r.top), pants = M(r.pants), shoes = M(r.shoes, { roughness: 0.4 });

    // 다리 (엉덩이에 회전축)
    var legs = [-0.1, 0.1].map(function (x) {
      var leg = new T.Group(); leg.position.set(x, 0.42, 0); body.add(leg);
      if (r.shorts) {
        add(leg, cap(0.07, 0.2), skin, 0, -0.18, 0);
        add(leg, new T.CylinderGeometry(0.078, 0.078, 0.14, 16), M(r.socks), 0, -0.27, 0);
      } else add(leg, cap(0.08, 0.22), pants, 0, -0.17, 0);
      add(leg, rbox(0.15, 0.09, 0.24, 0.04), shoes, 0, -0.37, 0.03);
      return leg;
    });
    if (r.shorts) add(body, new T.CylinderGeometry(0.2, 0.22, 0.17, 20), pants, 0, 0.44, 0);

    // 몸통
    var torso = add(body, cap(0.21, 0.2), top, 0, 0.66, 0); torso.scale.set(1, 1, 0.85);
    add(body, new T.CylinderGeometry(0.07, 0.08, 0.1, 12), skin, 0, 0.9, 0);

    // 팔 (어깨에 회전축)
    var arms = [-1, 1].map(function (s) {
      var arm = new T.Group(); arm.position.set(0.26 * s, 0.8, 0); arm.rotation.z = 0.12 * s; body.add(arm);
      add(arm, cap(0.065, 0.22), M(r.jacket || r.top), 0, -0.15, 0);
      add(arm, sph(0.07), skin, 0, -0.32, 0);
      return arm;
    });

    // 머리
    var head = new T.Group(); head.position.set(0, 1.14, 0); body.add(head);
    var skull = add(head, sph(0.3), skin); skull.scale.set(1, 0.95, 0.96);
    [-1, 1].forEach(function (s) { add(head, sph(0.06), skin, 0.29 * s, -0.02, 0); });
    hair(head);
    face(head);

    // 식은땀
    var sweat = new T.Group(); sweat.visible = false; head.add(sweat);
    var drop = M("#7CC4F2", { roughness: 0.1, transparent: true, opacity: 0.9 });
    [[0.3, 0.18, 0.12], [-0.31, 0.1, 0.1], [0.24, 0.3, 0.05]].forEach(function (p) {
      var d = add(sweat, new T.ConeGeometry(0.03, 0.06, 12), drop, p[0], p[1] + 0.03, p[2]); d.castShadow = false;
      add(sweat, sph(0.03), drop, p[0], p[1], p[2]).castShadow = false;
    });

    costume(key, r, { body: body, head: head, torso: torso, arms: arms, legs: legs });

    g.userData = { key: key, body: body, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], sweat: sweat, mug: null, t: Math.random() * 10 };
    if (key === "runner") {
      var mug = new T.Group(); mug.visible = false; arms[1].add(mug);
      add(mug, new T.CylinderGeometry(0.06, 0.055, 0.12, 16), M("#FFFFFF"), 0, -0.36, 0.06);
      g.userData.mug = mug;
    }
    g.traverse(function (o) { if (o.isMesh) o.receiveShadow = false; });
    return g;
  }

  function costume(key, r, p) {
    var trim = M(r.trim);
    switch (key) {
      case "me": {
        var n = decal("10", r.trim, 0.26); n.position.set(0, 0.68, 0.185); p.body.add(n);
        var band = add(p.arms[0], new T.CylinderGeometry(0.072, 0.072, 0.06, 16), trim, 0, -0.1, 0);
        var c = decal("C", "#1D5E40", 0.08); c.position.set(-0.07, -0.1, 0); c.rotation.y = -Math.PI / 2; p.arms[0].add(c);
        add(p.body, new T.TorusGeometry(0.09, 0.018, 8, 20, Math.PI), trim, 0, 0.86, 0.1).rotation.set(Math.PI / 2.4, 0, Math.PI);
        break;
      }
      case "runner": {
        var star = decal("✦", r.trim, 0.26); star.position.set(0, 0.68, 0.185); p.body.add(star);
        var hb = add(p.head, new T.TorusGeometry(0.305, 0.03, 10, 40), trim, 0, 0.1, 0); hb.rotation.x = Math.PI / 2 - 0.15;
        break;
      }
      case "archivist": {
        var vest = add(p.body, cap(0.218, 0.2), trim, 0, 0.66, -0.006); vest.scale.set(1, 1, 0.84);
        add(p.body, rbox(0.1, 0.36, 0.03, 0.012), M(r.top), 0, 0.7, 0.18);
        [0.58, 0.72].forEach(function (y) {
          var b = add(p.body, new T.TorusGeometry(0.205, 0.012, 6, 32), M("#E9EEF2", { metalness: 0.6, roughness: 0.25 }), 0, y, 0);
          b.rotation.x = Math.PI / 2; b.scale.set(1, 0.86, 1);
        });
        var hs = add(p.head, new T.TorusGeometry(0.33, 0.022, 8, 32, Math.PI), M("#2B2B2B"), 0, 0.02, 0);
        [-1, 1].forEach(function (s) { add(p.head, new T.CylinderGeometry(0.075, 0.075, 0.06, 18), M("#2B2B2B"), 0.31 * s, 0, 0).rotation.z = Math.PI / 2; });
        var boom = add(p.head, new T.CylinderGeometry(0.01, 0.01, 0.26, 8), M("#2B2B2B"), -0.24, -0.12, 0.14); boom.rotation.set(0.9, 0, 0.9);
        add(p.head, sph(0.03), M("#2B2B2B"), -0.14, -0.16, 0.25);
        var clip = new T.Group(); clip.position.set(0.02, -0.34, 0.1); clip.rotation.set(-0.5, 0, 0.1); p.arms[1].add(clip);
        add(clip, rbox(0.2, 0.27, 0.02, 0.01), M("#A9774A"));
        add(clip, rbox(0.16, 0.21, 0.01, 0.003), M("#FFFFFF"), 0, -0.01, 0.012);
        add(clip, rbox(0.08, 0.03, 0.02, 0.006), M("#9AA3AD", { metalness: 0.6 }), 0, 0.13, 0.012);
        break;
      }
      case "dev": {
        var hood = add(p.body, new T.TorusGeometry(0.15, 0.065, 10, 24), M("#285E43"), 0, 0.87, -0.08); hood.rotation.x = Math.PI / 2.3;
        [-0.06, 0.06].forEach(function (x) { add(p.body, new T.CylinderGeometry(0.008, 0.008, 0.17, 6), M("#F3F3F3"), x, 0.74, 0.19); });
        add(p.body, rbox(0.24, 0.1, 0.03, 0.02), M("#285E43"), 0, 0.53, 0.175);
        var hp = add(p.body, new T.TorusGeometry(0.16, 0.025, 8, 28), M("#151515", { roughness: 0.35 }), 0, 0.92, 0.02); hp.rotation.x = Math.PI / 2;
        [-1, 1].forEach(function (s) { add(p.body, new T.CylinderGeometry(0.06, 0.06, 0.05, 18), M("#151515", { roughness: 0.35 }), 0.15 * s, 0.9, 0.08).rotation.z = Math.PI / 2; });
        var lg = decal("λ", r.trim, 0.1); lg.position.set(0.1, 0.75, 0.18); p.body.add(lg);
        break;
      }
      case "server": {
        [0.58, 0.7].forEach(function (y) {
          var b = add(p.body, new T.TorusGeometry(0.205, 0.016, 6, 32), M(r.trim, { metalness: 0.7, roughness: 0.2 }), 0, y, 0);
          b.rotation.x = Math.PI / 2; b.scale.set(1, 0.86, 1);
        });
        p.arms.forEach(function (a) { var b = add(a, new T.CylinderGeometry(0.069, 0.069, 0.04, 14), M(r.trim, { metalness: 0.7, roughness: 0.2 }), 0, -0.16, 0); });
        var hat = M("#F5B700", { roughness: 0.35 });
        add(p.head, new T.SphereGeometry(0.33, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, 0.08, 0);
        add(p.head, new T.CylinderGeometry(0.4, 0.4, 0.03, 32), hat, 0, 0.08, 0.04);
        add(p.head, rbox(0.07, 0.08, 0.6, 0.03), hat, 0, 0.38, 0);
        add(p.body, rbox(0.1, 0.13, 0.015, 0.01), M("#FFFFFF"), 0.08, 0.6, 0.185);
        add(p.body, new T.TorusGeometry(0.11, 0.008, 6, 20, Math.PI), M("#E5484D"), 0.0, 0.83, 0.1).rotation.set(Math.PI / 2.4, 0, Math.PI);
        break;
      }
      case "scout": {
        add(p.body, rbox(0.016, 0.38, 0.02, 0.006), M("#FFFFFF"), 0, 0.68, 0.183);
        p.arms.forEach(function (a, i) { add(a, rbox(0.02, 0.3, 0.05, 0.008), M("#FFFFFF"), (i ? 1 : -1) * 0.058, -0.15, 0); });
        var capm = M("#D2463D", { roughness: 0.5 });
        add(p.head, new T.SphereGeometry(0.325, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), capm, 0, 0.06, 0);
        var brim = add(p.head, rbox(0.3, 0.025, 0.2, 0.01), capm, 0, 0.08, -0.36);
        add(p.head, sph(0.03), M("#A8342E"), 0, 0.39, 0);
        var bino = new T.Group(); bino.position.set(0, 0.62, 0.2); p.body.add(bino);
        [-0.06, 0.06].forEach(function (x) { add(bino, new T.CylinderGeometry(0.045, 0.05, 0.13, 16), M("#1B1B1B", { roughness: 0.3 }), x, 0, 0.02).rotation.x = Math.PI / 2; });
        add(bino, new T.TorusGeometry(0.17, 0.007, 6, 20, Math.PI), M("#1B1B1B"), 0, 0.02, -0.08).rotation.x = -0.4;
        break;
      }
      case "planner": {
        add(p.body, rbox(0.15, 0.3, 0.03, 0.012), M(r.shirt), 0, 0.73, 0.165);
        add(p.body, rbox(0.045, 0.22, 0.02, 0.01), trim, 0, 0.69, 0.185);
        [-1, 1].forEach(function (s) { var l = add(p.body, rbox(0.06, 0.24, 0.02, 0.01), M("#2A3A5C"), 0.085 * s, 0.75, 0.178); l.rotation.z = -0.35 * s; });
        add(p.body, rbox(0.05, 0.02, 0.015, 0.005), M("#FFFFFF"), -0.12, 0.76, 0.19);
        var marker = add(p.arms[1], new T.CylinderGeometry(0.018, 0.018, 0.16, 10), M("#1D5E40"), 0.0, -0.37, 0.05); marker.rotation.x = 1.2;
        break;
      }
    }
  }

  // 소개 카드용 정지 이미지
  var shotRenderer = null;
  function snapshot(key, size) {
    size = size || 160;
    if (!shotRenderer) {
      shotRenderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      shotRenderer.setPixelRatio(2);
    }
    shotRenderer.setSize(size, size);
    var sc = new T.Scene();
    sc.add(new T.HemisphereLight(0xffffff, 0xd8cfc2, 2.2));
    var dl = new T.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 4); sc.add(dl);
    var c = build(key); c.rotation.y = 0.35; sc.add(c);
    var cam = new T.PerspectiveCamera(26, 1, 0.1, 50);
    cam.position.set(0.9, 1.3, 3.6); cam.lookAt(0, 0.82, 0);
    shotRenderer.render(sc, cam);
    return shotRenderer.domElement.toDataURL("image/png");
  }

  root.Characters = { BASE: BASE, ROLES: ROLES, build: build, snapshot: snapshot, M: M, rbox: rbox };
})(typeof self !== "undefined" ? self : this);
