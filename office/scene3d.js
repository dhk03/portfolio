/*
 * DH 타워 3D 사무실 — Three.js 아이소메트릭 디오라마.
 * office.js가 세션 상태를 넘겨주면 방 불을 켜고, 클로드 동환을 걷게 하고, 화면·화이트보드를 다시 그린다.
 */
(function (root) {
  "use strict";
  var T = root.THREE, C = root.Characters, M = C.M, rbox = C.rbox;
  var V = function (x, y, z) { return new T.Vector3(x, y, z); };

  // 방 6개 + 라운지 복도. 뒤쪽 줄(z<0)과 앞쪽 줄(z>0) 사이가 복도다.
  var ROOMS = {
    library: { cx: -6, cz: -3.75, back: true, floor: "#F1E3CB", wall: "#F7EEDF", label: "📚 자료실" },
    dev: { cx: 0, cz: -3.75, back: true, floor: "#D6EADE", wall: "#E6F2EA", label: "💻 개발실" },
    server: { cx: 6, cz: -3.75, back: true, floor: "#3B4556", wall: "#475266", label: "🗄️ 서버실", dark: true },
    search: { cx: -6, cz: 3.75, floor: "#DBE6F5", label: "🌐 정보검색실" },
    meeting: { cx: 0, cz: 3.75, floor: "#F6E8D9", label: "🗒️ 회의실" },
    desk: { cx: 6, cz: 3.75, floor: "#E1EED8", label: "🧑‍💻 내 자리" }
  };
  // 러너가 서는 자리, 담당자가 서는 자리 (월드 좌표 x, z)
  var SPOT = { library: [-5, -2.2], dev: [1.3, -2.35], server: [6.2, -2.25], search: [-5.6, 4.1], meeting: [1.6, 2.65], desk: [4.5, 3.4], lounge: [-1.7, 0.35] };
  var STAFF = { library: [-7.4, -3.0], dev: [-1.25, -4.3], server: [7.7, -2.85], search: [-7.6, 4.4], meeting: [-2.15, 2.8], desk: [6.4, 3.3] };
  var CH = 1.3; // 캐릭터 크기
  var ROLE_OF = { library: "archivist", dev: "dev", server: "server", search: "scout", meeting: "planner", desk: "me" };

  function canvasTex(w, h) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    return { c: c, x: c.getContext("2d"), tex: tex };
  }
  function rr(x, X, y, w, h, r) { x.beginPath(); x.roundRect(X, y, w, h, r); }
  function clipText(x, s, max) {
    s = String(s || "");
    if (x.measureText(s).width <= max) return s;
    while (s.length > 1 && x.measureText(s + "…").width > max) s = s.slice(0, -1);
    return s + "…";
  }
  var UI = '"Pretendard", "IBM Plex Sans KR", system-ui, sans-serif';
  var MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace';

  function create(container, overlay) {
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    var scene = new T.Scene();
    var cam = new T.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    var view = { az: Math.PI / 4, el: 0.6, azTarget: Math.PI / 4, target: V(0, 0.4, 0.3) };

    // ---------- 빛 ----------
    scene.add(new T.HemisphereLight(0xffffff, 0xd9cdbd, 1.5));
    var sun = new T.DirectionalLight(0xfff1e0, 2.6);
    sun.position.set(-7, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
    scene.add(sun);
    var fill = new T.DirectionalLight(0xdfe9ff, 0.6); fill.position.set(10, 6, 6); scene.add(fill);

    // ---------- 도우미 ----------
    function box(parent, w, h, d, color, x, y, z, r, o) {
      var m = new T.Mesh(rbox(w, h, d, r), typeof color === "string" ? M(color, o) : color);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    function cyl(parent, rt, rb, h, color, x, y, z, o) {
      var m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, 28), typeof color === "string" ? M(color, o) : color);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    function ball(parent, r, color, x, y, z, o) {
      var m = new T.Mesh(new T.SphereGeometry(r, 24, 16), typeof color === "string" ? M(color, o) : color);
      m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    }
    function screen(parent, w, h, tex, x, y, z, ry) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
      m.position.set(x, y, z); if (ry) m.rotation.y = ry; parent.add(m); return m;
    }
    function plant(parent, x, z, s) {
      s = s || 1;
      cyl(parent, 0.2 * s, 0.15 * s, 0.36 * s, "#E07A55", x, 0.18 * s, z, { roughness: 0.7 });
      [[0, 0.62, 0, 0.26], [-0.14, 0.5, 0.08, 0.2], [0.15, 0.52, -0.05, 0.2], [0.02, 0.78, -0.06, 0.18]].forEach(function (p) {
        ball(parent, p[3] * s, "#4E9B66", x + p[0] * s, p[1] * s, z + p[2] * s, { roughness: 0.75 });
      });
    }

    // ---------- 건물 ----------
    var world = new T.Group(); scene.add(world);
    var shadowCatcher = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: 0.1 }));
    shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = -0.62; shadowCatcher.receiveShadow = true; world.add(shadowCatcher);
    box(world, 19.0, 0.6, 13.3, "#FBF8F3", 0, -0.31, 0, 0.28);
    box(world, 18.2, 0.08, 2.5, "#EFE9DF", 0, 0.02, 0, 0.03); // 복도 바닥

    var rooms = {};
    Object.keys(ROOMS).forEach(function (k) {
      var R = ROOMS[k];
      var g = new T.Group(); g.position.set(R.cx, 0, R.cz); world.add(g);
      var fm = new T.MeshStandardMaterial({ color: R.floor, roughness: 0.8, emissive: new T.Color("#000000") });
      box(g, 5.9, 0.1, 4.9, fm, 0, 0.03, 0, 0.04);
      var glow = new T.PointLight(0xffd59a, 0, 7.5, 1.6); glow.position.set(0, 2.4, 0.3); g.add(glow);
      rooms[k] = { g: g, floorMat: fm, glow: glow, on: 0, fail: 0 };
      if (R.back) box(world, 6, 2.7, 0.22, R.wall, R.cx, 1.35, -6.36, 0.06);
    });
    box(world, 0.22, 2.7, 12.95, "#F5F1EA", -9.11, 1.35, 0.02, 0.06); // 왼쪽 벽
    // 낮은 칸막이 (방 사이, 복도 쪽은 문 자리를 비움)
    var wallMat = M("#FFFFFF", { roughness: 0.6 });
    [-3, 3].forEach(function (x) { [-3.75, 3.75].forEach(function (z) { box(world, 0.14, 0.44, 4.9, wallMat, x, 0.22, z, 0.05); }); });
    [-1.25, 1.25].forEach(function (z) {
      [-6, 0, 6].forEach(function (cx) { [-1.95, 1.95].forEach(function (dx) { box(world, 2.08, 0.44, 0.14, wallMat, cx + dx, 0.22, z, 0.05); }); });
    });

    // ---------- 자료실 ----------
    var lib = rooms.library.g, books = [];
    var BOOK = ["#1D5E40", "#E8B21E", "#C8473A", "#2F63B0", "#7A5CA6", "#D97757", "#3E8A72", "#F1ECE1", "#24324F"];
    [-1.85, 0, 1.85].forEach(function (sx) {
      var wood = "#C99B6E";
      box(lib, 1.62, 2.15, 0.08, "#B98A5E", sx, 1.1, -2.4, 0.03);
      [-0.78, 0.78].forEach(function (dx) { box(lib, 0.08, 2.15, 0.48, wood, sx + dx, 1.1, -2.2, 0.03); });
      [0.06, 0.74, 1.42, 2.12].forEach(function (y) { box(lib, 1.62, 0.06, 0.48, wood, sx, y, -2.2, 0.02); });
      [0.09, 0.77, 1.45].forEach(function (y) {
        var x = sx - 0.7;
        while (x < sx + 0.66) {
          var w = 0.07 + Math.random() * 0.06, h = 0.38 + Math.random() * 0.2;
          var b = box(lib, w, h, 0.32, BOOK[(Math.random() * BOOK.length) | 0], x + w / 2, y + h / 2, -2.17, 0.012);
          if (Math.random() < 0.08) { b.userData.baseZ = b.position.z; books.push(b); }
          x += w + 0.008;
        }
      });
    });
    var tableTop = "#EBD7B6";
    box(lib, 1.9, 0.07, 1.0, tableTop, 0.9, 0.74, 0.35, 0.03);
    [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]].forEach(function (p) { cyl(lib, 0.035, 0.035, 0.72, "#9C7653", 0.9 + p[0], 0.36, 0.35 + p[1]); });
    box(lib, 0.4, 0.12, 0.3, "#FFFFFF", 0.5, 0.84, 0.3, 0.02);
    box(lib, 0.36, 0.05, 0.28, "#2F63B0", 0.52, 0.93, 0.31, 0.02);
    cyl(lib, 0.06, 0.09, 0.04, "#22201E", 1.55, 0.8, 0.1);
    var lampArm = cyl(lib, 0.015, 0.015, 0.5, "#22201E", 1.55, 1.04, 0.1); lampArm.rotation.z = 0.3;
    var shade = cyl(lib, 0.06, 0.16, 0.14, "#E8B21E", 1.45, 1.28, 0.1); shade.rotation.z = 0.5;
    var rug = cyl(lib, 1.1, 1.1, 0.02, "#E3C69C", -0.9, 0.09, 0.9, { roughness: 0.95 }); rug.castShadow = false;
    var flyBook = box(lib, 0.3, 0.06, 0.22, "#1D5E40", 0, 1.4, -1.5, 0.02); flyBook.visible = false;

    // ---------- 개발실 ----------
    var dev = rooms.dev.g;
    box(dev, 2.9, 0.08, 1.1, "#FFFFFF", 0.3, 0.76, -1.55, 0.03);
    [[-1.35, -0.45], [1.35, -0.45], [-1.35, 0.45], [1.35, 0.45]].forEach(function (p) { cyl(dev, 0.03, 0.03, 0.74, "#B8BEC6", 0.3 + p[0], 0.37, -1.55 + p[1], { metalness: 0.6, roughness: 0.3 }); });
    var silver = M("#E6E8EB", { metalness: 0.35, roughness: 0.3 });
    box(dev, 0.26, 0.42, 0.05, silver, 0.3, 1.0, -1.82, 0.02).rotation.x = -0.12;
    box(dev, 0.5, 0.03, 0.32, silver, 0.3, 0.815, -1.78, 0.015);
    box(dev, 1.56, 1.02, 0.07, silver, 0.3, 1.52, -1.86, 0.05);
    box(dev, 1.56, 0.16, 0.075, M("#D7DADF", { metalness: 0.3, roughness: 0.35 }), 0.3, 1.09, -1.86, 0.04);
    var codeT = canvasTex(640, 360);
    screen(dev, 1.44, 0.81, codeT.tex, 0.3, 1.6, -1.82);
    box(dev, 0.72, 0.03, 0.22, "#FFFFFF", 0.3, 0.815, -1.22, 0.012);
    box(dev, 0.12, 0.03, 0.18, "#FFFFFF", 0.85, 0.815, -1.2, 0.03);
    cyl(dev, 0.05, 0.05, 0.12, "#E8B21E", -0.85, 0.86, -1.4);
    box(dev, 0.62, 0.1, 0.6, "#2F6E4F", 0.3, 0.5, -0.55, 0.05);
    box(dev, 0.62, 0.7, 0.1, "#2F6E4F", 0.3, 0.9, -0.28, 0.05);
    cyl(dev, 0.04, 0.04, 0.42, "#22201E", 0.3, 0.24, -0.55);
    plant(dev, -2.4, -2.05, 1.3);
    box(world, 1.5, 1.0, 0.05, M("#CFE6F7", { roughness: 0.15, metalness: 0.1 }), 1.9, 1.75, -6.23, 0.03);
    box(world, 1.6, 0.06, 0.12, "#FFFFFF", 1.9, 1.22, -6.2, 0.02);

    // ---------- 서버실 ----------
    var srv = rooms.server.g;
    var LED_N = 3 * 3 * 9, ledGeo = new T.BoxGeometry(0.06, 0.035, 0.02);
    var leds = new T.InstancedMesh(ledGeo, new T.MeshBasicMaterial({ toneMapped: false }), LED_N);
    var ledInfo = [], dummy = new T.Object3D(), k = 0;
    [-1.7, -0.55, 0.6].forEach(function (rx) {
      box(srv, 0.98, 2.15, 0.86, "#171B23", rx, 1.08, -1.95, 0.06, { roughness: 0.4 });
      box(srv, 0.86, 2.0, 0.03, "#222936", rx, 1.08, -1.51, 0.02, { roughness: 0.3, metalness: 0.3 });
      for (var row = 0; row < 9; row++) {
        box(srv, 0.78, 0.012, 0.012, "#3A4456", rx, 0.3 + row * 0.2, -1.49, 0.004);
        for (var col = 0; col < 3; col++) {
          dummy.position.set(rx - 0.3 + col * 0.1, 0.36 + row * 0.2, -1.485); dummy.updateMatrix();
          leds.setMatrixAt(k, dummy.matrix);
          var r = Math.random();
          ledInfo.push({ color: new T.Color(r < 0.15 ? "#F5B700" : r < 0.3 ? "#5AA9FF" : "#3DDC84"), phase: Math.random() * 10, rate: 0.6 + Math.random() * 1.2 });
          k++;
        }
      }
    });
    leds.instanceMatrix.needsUpdate = true; srv.add(leds);
    var termT = canvasTex(640, 360);
    box(srv, 1.5, 0.95, 0.06, "#0D1016", 1.95, 1.65, -2.42, 0.04);
    screen(srv, 1.4, 0.79, termT.tex, 1.95, 1.65, -2.385);
    var strip = box(srv, 5.6, 0.02, 0.05, new T.MeshBasicMaterial({ color: "#5EE6FF", toneMapped: false }), 0, 0.09, 1.0, 0.01);
    strip.castShadow = false;
    var cool = box(srv, 0.6, 1.1, 0.5, "#E9EEF3", -2.45, 0.6, 0.9, 0.08);
    cyl(srv, 0.17, 0.17, 0.03, "#9AA6B5", -2.45, 0.95, 1.16).rotation.x = Math.PI / 2;

    // ---------- 정보검색실 ----------
    var sch = rooms.search.g;
    cyl(sch, 0.3, 0.38, 0.06, "#8A6A4E", -1.7, 0.08, -1.0);
    cyl(sch, 0.03, 0.03, 0.75, "#B8BEC6", -1.7, 0.45, -1.0, { metalness: 0.6 });
    var globe = new T.Group(); globe.position.set(-1.7, 1.25, -1.0); globe.rotation.z = 0.4; sch.add(globe);
    var globeT = canvasTex(512, 256);
    (function () {
      var x = globeT.x; x.fillStyle = "#3C86D9"; x.fillRect(0, 0, 512, 256);
      x.fillStyle = "#6CC48A";
      [[80, 70, 60, 40], [120, 150, 40, 55], [250, 60, 70, 35], [270, 130, 45, 60], [380, 80, 80, 45], [420, 180, 35, 25]].forEach(function (b) { x.beginPath(); x.ellipse(b[0], b[1], b[2], b[3], 0.3, 0, 7); x.fill(); });
      globeT.tex.needsUpdate = true;
    })();
    var gm = new T.Mesh(new T.SphereGeometry(0.5, 40, 28), new T.MeshStandardMaterial({ map: globeT.tex, roughness: 0.35 })); gm.castShadow = true; globe.add(gm);
    var ring = new T.Mesh(new T.TorusGeometry(0.58, 0.02, 8, 48), M("#C9A35A", { metalness: 0.7, roughness: 0.3 })); ring.rotation.y = Math.PI / 2; globe.add(ring);
    var wire = new T.Mesh(new T.SphereGeometry(0.52, 16, 10), new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.18 })); globe.add(wire);
    var sd = new T.Group(); sd.position.set(1.1, 0, -1.5); sd.rotation.y = 0.45; sch.add(sd);
    box(sd, 1.7, 0.07, 0.9, "#FFFFFF", 0, 0.74, 0, 0.03);
    [[-0.78, -0.38], [0.78, -0.38], [-0.78, 0.38], [0.78, 0.38]].forEach(function (p) { cyl(sd, 0.03, 0.03, 0.72, "#B8BEC6", p[0], 0.36, p[1], { metalness: 0.6 }); });
    box(sd, 1.3, 0.8, 0.06, "#1D2230", 0, 1.3, -0.25, 0.04);
    cyl(sd, 0.04, 0.04, 0.3, "#B8BEC6", 0, 0.92, -0.3);
    var searchT = canvasTex(640, 380);
    screen(sd, 1.22, 0.72, searchT.tex, 0, 1.3, -0.215);
    var plugs = [-0.35, -0.1, 0.15].map(function (x) {
      var mat = new T.MeshStandardMaterial({ color: "#7C8796", emissive: new T.Color("#000000"), roughness: 0.4 });
      box(sd, 0.12, 0.14, 0.12, mat, x + 0.35, 0.85, 0.25, 0.03);
      return mat;
    });
    var bean = ball(sch, 0.55, "#F2B25C", 1.4, 0.3, 1.0, { roughness: 0.85 }); bean.scale.set(1, 0.55, 1);
    box(world, 0.05, 1.0, 1.5, M("#CFE6F7", { roughness: 0.15 }), -8.98, 1.6, 3.75, 0.03);

    // ---------- 회의실 ----------
    var mtg = rooms.meeting.g;
    var boardT = canvasTex(900, 500);
    var wb = new T.Group(); wb.position.set(-0.3, 0, -1.6); wb.rotation.y = 0.5; mtg.add(wb); // 카메라 쪽으로 살짝 돌려 글씨가 보이게
    box(wb, 2.9, 1.66, 0.08, "#D9DEE4", 0, 1.55, 0, 0.04, { metalness: 0.3, roughness: 0.35 });
    screen(wb, 2.76, 1.53, boardT.tex, 0, 1.55, 0.045);
    [-1.2, 1.2].forEach(function (x) { cyl(wb, 0.03, 0.03, 0.75, "#B8BEC6", x, 0.38, 0, { metalness: 0.6 }); });
    box(wb, 1.2, 0.04, 0.12, "#B8BEC6", 0, 0.74, 0.09, 0.01);
    ["#1E3A8A", "#C8473A", "#1D5E40"].forEach(function (c, i) { cyl(wb, 0.02, 0.02, 0.14, c, -0.3 + i * 0.12, 0.78, 0.11).rotation.z = Math.PI / 2; });
    cyl(mtg, 0.98, 0.98, 0.07, "#FFFFFF", 0.7, 0.74, 0.75);
    cyl(mtg, 0.06, 0.06, 0.7, "#B8BEC6", 0.7, 0.37, 0.75);
    cyl(mtg, 0.35, 0.35, 0.03, "#B8BEC6", 0.7, 0.03, 0.75);
    ["#F2B25C", "#8FB8E8", "#E88B7A", "#9BCB9C"].forEach(function (c, i) {
      var a = i * Math.PI / 2 + Math.PI / 4, x = 0.7 + Math.cos(a) * 1.25, z = 0.75 + Math.sin(a) * 1.25;
      box(mtg, 0.5, 0.12, 0.5, c, x, 0.45, z, 0.06);
      cyl(mtg, 0.03, 0.03, 0.4, "#B8BEC6", x, 0.2, z);
    });
    box(mtg, 0.25, 0.02, 0.32, "#FFFFFF", 0.4, 0.785, 0.6, 0.005);
    cyl(mtg, 0.05, 0.05, 0.1, "#D97757", 1.1, 0.83, 0.9);

    // ---------- 내 자리 ----------
    var dsk = rooms.desk.g;
    box(dsk, 2.4, 0.08, 1.05, "#C99A6B", 0.3, 0.76, 0.2, 0.03);
    box(dsk, 0.08, 0.72, 0.95, "#B08356", -0.85, 0.37, 0.2, 0.02);
    box(dsk, 0.08, 0.72, 0.95, "#B08356", 1.45, 0.37, 0.2, 0.02);
    box(dsk, 2.2, 0.5, 0.04, "#B08356", 0.3, 0.5, 0.68, 0.02);
    var mon = box(dsk, 0.85, 0.55, 0.05, "#F4F4F4", -0.55, 1.2, 0.05, 0.03); mon.rotation.y = 0.6;
    cyl(dsk, 0.04, 0.04, 0.22, "#F4F4F4", -0.55, 0.9, 0.05);
    var mug = cyl(dsk, 0.065, 0.06, 0.14, "#FFFFFF", 1.05, 0.87, 0.35);
    var steam = [0, 1].map(function (i) { var s = ball(dsk, 0.04, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }), 1.05, 1.0 + i * 0.1, 0.35); s.castShadow = false; return s; });
    var plateT = canvasTex(256, 64);
    (function () { var x = plateT.x; x.fillStyle = "#E8B21E"; rr(x, 0, 0, 256, 64, 10); x.fill(); x.fillStyle = "#1C1714"; x.font = "800 28px " + UI; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("김동환 · 주장", 128, 34); plateT.tex.needsUpdate = true; })();
    box(dsk, 0.62, 0.15, 0.05, "#E8B21E", -0.3, 0.87, 0.62, 0.02);
    screen(dsk, 0.6, 0.15, plateT.tex, -0.3, 0.87, 0.646);
    box(dsk, 0.26, 0.2, 0.03, "#FFFFFF", 1.2, 0.9, 0.05, 0.01).rotation.y = -0.4;
    box(dsk, 0.7, 0.95, 0.12, "#1D5E40", 0.4, 1.0, -1.05, 0.06);
    box(dsk, 0.62, 0.1, 0.55, "#1D5E40", 0.4, 0.5, -0.7, 0.05);
    plant(dsk, 2.4, -1.9, 1.1);
    var trophy = cyl(dsk, 0.05, 0.08, 0.06, "#E8B21E", -0.75, 0.83, 0.45, { metalness: 0.8, roughness: 0.25 });
    ball(dsk, 0.08, M("#E8B21E", { metalness: 0.8, roughness: 0.25 }), -0.75, 0.96, 0.45);

    // ---------- 라운지 ----------
    var sofa = "#D8735A";
    box(world, 2.3, 0.36, 0.8, sofa, -3.4, 0.3, -0.62, 0.12);
    box(world, 2.3, 0.62, 0.22, sofa, -3.4, 0.62, -0.95, 0.1);
    [-1, 1].forEach(function (s) { box(world, 0.22, 0.5, 0.8, sofa, -3.4 + s * 1.1, 0.42, -0.62, 0.1); });
    [-0.5, 0.5].forEach(function (dx) { box(world, 0.95, 0.12, 0.6, "#E58A70", -3.4 + dx, 0.53, -0.58, 0.06); });
    cyl(world, 0.36, 0.36, 0.05, "#FFFFFF", -3.4, 0.38, 0.4);
    cyl(world, 0.04, 0.04, 0.34, "#B8BEC6", -3.4, 0.18, 0.4);
    box(world, 0.5, 1.0, 0.45, "#EDF1F5", -8.4, 0.52, -0.75, 0.08);
    var bottle = cyl(world, 0.17, 0.17, 0.45, new T.MeshStandardMaterial({ color: "#8CC8F2", transparent: true, opacity: 0.7, roughness: 0.1 }), -8.4, 1.25, -0.75);
    plant(world, 8.5, -0.75, 1.4);
    // 미니 골대
    var goal = new T.Group(); goal.position.set(3.7, 0, -0.65); world.add(goal);
    var white = M("#FFFFFF", { roughness: 0.3 });
    [-0.6, 0.6].forEach(function (x) { cyl(goal, 0.035, 0.035, 0.75, white, x, 0.38, 0.2); });
    cyl(goal, 0.035, 0.035, 1.2, white, 0, 0.75, 0.2).rotation.z = Math.PI / 2;
    var net = new T.Mesh(new T.BoxGeometry(1.2, 0.74, 0.45, 8, 5, 3), new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 }));
    net.position.set(0, 0.38, -0.02); goal.add(net);
    var ballT = canvasTex(256, 128);
    (function () { var x = ballT.x; x.fillStyle = "#fff"; x.fillRect(0, 0, 256, 128); x.fillStyle = "#1C1714"; [[40, 40], [128, 64], [216, 40], [80, 110], [180, 110], [0, 100], [256, 100]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 16, 0, 7); x.fill(); }); ballT.tex.needsUpdate = true; })();
    var soccer = new T.Mesh(new T.SphereGeometry(0.12, 24, 16), new T.MeshStandardMaterial({ map: ballT.tex, roughness: 0.4 }));
    soccer.castShadow = true; soccer.position.set(2.6, 0.17, 0.3); world.add(soccer);
    var ballHome = soccer.position.clone(), kickT = -1;
    var flagT = canvasTex(256, 128);
    (function () { var x = flagT.x; x.fillStyle = "#1D5E40"; x.beginPath(); x.moveTo(0, 0); x.lineTo(256, 64); x.lineTo(0, 128); x.fill(); x.fillStyle = "#E8B21E"; x.font = "800 40px " + UI; x.textBaseline = "middle"; x.fillText("DH FC", 20, 66); flagT.tex.needsUpdate = true; })();
    var flag = new T.Mesh(new T.PlaneGeometry(0.9, 0.45), new T.MeshBasicMaterial({ map: flagT.tex, transparent: true, side: T.DoubleSide }));
    flag.position.set(5.4, 1.1, -1.17); world.add(flag);
    cyl(world, 0.02, 0.02, 1.1, "#B8BEC6", 4.95, 0.75, -1.17);
    // 엘리베이터
    var metal = M("#C9D0D8", { metalness: 0.7, roughness: 0.28 });
    box(world, 0.1, 2.2, 1.7, M("#9AA4B0", { metalness: 0.6, roughness: 0.3 }), -8.98, 1.1, 0, 0.03);
    var doorL = box(world, 0.06, 2.0, 0.74, metal, -8.92, 1.02, -0.38, 0.02);
    var doorR = box(world, 0.06, 2.0, 0.74, metal, -8.92, 1.02, 0.38, 0.02);
    var evT = canvasTex(256, 96);
    screen(world, 0.7, 0.26, evT.tex, -8.92, 2.34, 0, Math.PI / 2);
    function drawEv(n, arrow) {
      var x = evT.x; x.fillStyle = "#0E141E"; x.fillRect(0, 0, 256, 96);
      x.fillStyle = "#FF7A45"; x.font = "700 60px " + MONO; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText((arrow || "") + (n ? n + "F" : "–"), 128, 52); evT.tex.needsUpdate = true;
    }
    drawEv(0);

    // ---------- 사람 ----------
    var people = {};
    Object.keys(STAFF).forEach(function (room) {
      var c = C.build(ROLE_OF[room]);
      c.position.set(STAFF[room][0], 0.08, STAFF[room][1]);
      c.rotation.y = Math.PI / 4;
      c.scale.setScalar(CH);
      world.add(c);
      people[room] = c;
    });
    // 나는 내 책상 뒤에 앉아 있다
    var me = people.desk;
    me.rotation.y = 0.15; me.position.y = -0.02;
    me.userData.seated = true;
    var runner = C.build("runner");
    runner.position.set(SPOT.lounge[0], 0.08, SPOT.lounge[1]); runner.rotation.y = Math.PI / 4; runner.scale.setScalar(CH);
    world.add(runner);
    people.runner = runner;

    // ---------- HTML 오버레이 ----------
    var ov = [];
    function overlayEl(cls, html, pos, follow, dy) {
      var el = document.createElement("div"); el.className = "ov " + cls; if (html) el.innerHTML = html;
      overlay.appendChild(el);
      var anchor = /^tag/.test(cls) ? " translate(-50%,6px)" : /^chip/.test(cls) ? " translate(0,-100%)" : /^who/.test(cls) ? "" : " translate(-50%,-100%)";
      var item = { el: el, pos: pos, follow: follow, dy: dy || 0, anchor: anchor };
      ov.push(item);
      return el;
    }
    var chips = {};
    Object.keys(ROOMS).forEach(function (k) {
      var R = ROOMS[k];
      var p = R.back ? V(R.cx - 1.2, 2.95, -6.3) : V(R.cx + 1.2, 0.15, R.cz + 2.75);
      chips[k] = overlayEl("chip" + (R.dark ? " dark" : ""), '<span class="t">' + R.label + '</span><b class="n"></b>', p);
    });
    var hosts = {};
    function host(key, obj, name, cls, headY) {
      var h = overlayEl("who " + cls, '<div class="bubble"></div>', null, obj, headY);
      var tag = overlayEl("tag " + cls, name, null, obj, -0.12);
      hosts[key] = h; h._tag = tag;
    }
    Object.keys(STAFF).forEach(function (room) { host(room, people[room], C.ROLES[ROLE_OF[room]].name, room === "desk" ? "me" : "", (room === "desk" ? 1.25 : 1.6) * CH); });
    host("runner", runner, C.ROLES.runner.name, "runner", 1.6 * CH);
    var fileCard = overlayEl("card file", '<small>지금 읽는 파일</small><span class="v">—</span>', V(-5.1, 1.35, -3.4));
    var gitBadge = overlayEl("card git", "⎇ git", V(7.4, 2.35, -6.0));
    var askCard = overlayEl("card ask", '<div class="q"></div><div class="opts"></div>', V(6.9, 3.7, 3.6));
    var alertEl = overlayEl("alert", "!", null, me, 1.85 * CH);

    // ---------- 카메라 ----------
    var W = 1, H = 1;
    function resize() {
      W = container.clientWidth; H = container.clientHeight;
      renderer.setSize(W, H);
      var aspect = W / H, halfH = 7.4;
      var needW = aspect < 1.3 ? 10.4 : 11.6; // 폰에선 가장자리를 조금 잘라 크게 보이게
      if (aspect * halfH < needW) halfH = needW / aspect;
      cam.left = -halfH * aspect; cam.right = halfH * aspect; cam.top = halfH; cam.bottom = -halfH;
      cam.updateProjectionMatrix();
    }
    function placeCam() {
      var d = 40;
      cam.position.set(view.target.x + d * Math.cos(view.el) * Math.sin(view.az), view.target.y + d * Math.sin(view.el), view.target.z + d * Math.cos(view.el) * Math.cos(view.az));
      cam.lookAt(view.target);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container); else window.addEventListener("resize", resize);
    resize();

    // 끌어서 살짝 돌려 보기 (두 번 누르면 원위치)
    var drag = null;
    renderer.domElement.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, az: view.azTarget }; renderer.domElement.setPointerCapture(e.pointerId); });
    renderer.domElement.addEventListener("pointermove", function (e) {
      if (!drag) return;
      view.azTarget = Math.max(Math.PI / 4 - 0.55, Math.min(Math.PI / 4 + 0.55, drag.az - (e.clientX - drag.x) * 0.004));
    });
    renderer.domElement.addEventListener("pointerup", function () { drag = null; });
    renderer.domElement.addEventListener("dblclick", function () { view.azTarget = Math.PI / 4; });

    // ---------- 캔버스 화면 ----------
    var state = { code: [], file: "", command: "", git: false, query: "", mcp: false, plan: [], active: null, fontReady: false };
    var codeScroll = 0;
    function tokenColor(tok) {
      if (/^(def|return|import|from|export|const|let|var|for|in|if|else|function|class|select|where|and|or|is|null|async|await|new|interval)$/.test(tok)) return "#FF9E7A";
      if (/^["'`]/.test(tok)) return "#B5E48C";
      if (/^\d/.test(tok)) return "#F6C177";
      return null;
    }
    function drawCode() {
      var x = codeT.x, w = 640, h = 360;
      var g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#151A24"); g.addColorStop(1, "#1C2230");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = "#222938"; x.fillRect(0, 0, w, 34);
      ["#FF5F57", "#FEBC2E", "#28C840"].forEach(function (c, i) { x.fillStyle = c; x.beginPath(); x.arc(20 + i * 18, 17, 6, 0, 7); x.fill(); });
      x.fillStyle = "#2D3546"; rr(x, 82, 6, 200, 22, 6); x.fill();
      x.fillStyle = "#C8D3E6"; x.font = "500 14px " + MONO; x.textBaseline = "middle"; x.fillText(clipText(x, state.file || "untitled", 180), 94, 18);
      var lines = state.code.length ? state.code : ["// 아직 고친 코드가 없어요"];
      x.save(); x.beginPath(); x.rect(0, 34, w, h - 34); x.clip();
      x.font = "15px " + MONO; x.textBaseline = "alphabetic";
      var lh = 22, total = lines.length * lh + 30, off = state.active === "dev" && lines.length > 12 ? codeScroll % total : 0;
      for (var rep = 0; rep < 2; rep++) {
        lines.forEach(function (line, i) {
          var y = 60 + i * lh - off + rep * total;
          if (y < 34 || y > h + lh) return;
          x.fillStyle = "#4A5468"; x.textAlign = "right"; x.fillText(String(i + 1), 38, y); x.textAlign = "left";
          var cx = 52;
          if (/^\s*(#|\/\/|--)/.test(line)) { x.fillStyle = "#6B7590"; x.fillText(line, cx, y); return; }
          line.split(/(\s+|[()\[\]{},.:=])/).forEach(function (tok) {
            if (!tok) return;
            x.fillStyle = tokenColor(tok) || (/^[a-zA-Z_]\w*$/.test(tok) ? "#D7E0F0" : "#8FA0BF");
            x.fillText(tok, cx, y); cx += x.measureText(tok).width;
          });
        });
        if (!off) break;
      }
      if (state.active === "dev" && (Date.now() / 500 | 0) % 2) { x.fillStyle = "#7AA2FF"; x.fillRect(52, h - 26, 9, 18); }
      x.restore();
      codeT.tex.needsUpdate = true;
    }
    function drawTerm() {
      var x = termT.x, w = 640, h = 360;
      x.fillStyle = "#0B0E13"; x.fillRect(0, 0, w, h);
      x.font = "600 18px " + MONO; x.textBaseline = "middle";
      x.fillStyle = "#5EE6FF"; x.fillText("dh-tower:~", 24, 34);
      var on = state.active === "server";
      x.fillStyle = "#F5B700"; x.fillText("$", 24, 74);
      x.fillStyle = "#E6EDF7"; x.fillText(clipText(x, state.command || "대기 중", 560), 46, 74);
      if (on) {
        var n = (Date.now() / 140 | 0) % 7;
        x.fillStyle = "#3DDC84"; x.font = "15px " + MONO;
        ["▸ running", "  ████████░░░░", "  ok"].forEach(function (s, i) { if (i <= n % 3) x.fillText(s, 46, 120 + i * 30); });
        if ((Date.now() / 450 | 0) % 2) x.fillRect(46, 210, 11, 20);
      }
      if (state.git) {
        x.fillStyle = "#F05133"; rr(x, w - 120, 20, 96, 34, 10); x.fill();
        x.fillStyle = "#fff"; x.font = "700 18px " + UI; x.textAlign = "center"; x.fillText("⎇ git", w - 72, 38); x.textAlign = "left";
      }
      termT.tex.needsUpdate = true;
    }
    function drawSearch() {
      var x = searchT.x, w = 640, h = 380;
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#EEF3FA");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = "#F1F4F9"; rr(x, 40, 36, w - 80, 56, 28); x.fill();
      x.strokeStyle = state.active === "search" ? "#5B8DEF" : "#D8DFEA"; x.lineWidth = 3; x.stroke();
      x.fillStyle = "#5B8DEF"; x.font = "600 24px " + UI; x.textBaseline = "middle"; x.fillText("⌕", 62, 64);
      x.fillStyle = "#1F2633"; x.font = "500 22px " + UI; x.fillText(clipText(x, state.query || "무엇이든 찾아드려요", w - 170), 96, 65);
      var t = Date.now() / 600;
      [0.9, 0.62, 0.78, 0.55].forEach(function (f, i) {
        var a = state.active === "search" ? 0.45 + 0.55 * Math.abs(Math.sin(t + i * 0.7)) : 1;
        x.globalAlpha = a;
        x.fillStyle = i ? "#D5DEEA" : "#9DB9EE"; rr(x, 48, 128 + i * 52, (w - 96) * f, 18, 9); x.fill();
        x.fillStyle = "#E7ECF3"; rr(x, 48, 152 + i * 52, (w - 96) * f * 0.7, 10, 5); x.fill();
      });
      x.globalAlpha = 1;
      if (state.mcp) { x.fillStyle = "#1D5E40"; rr(x, w - 140, 330, 100, 32, 16); x.fill(); x.fillStyle = "#fff"; x.font = "700 16px " + UI; x.textAlign = "center"; x.fillText("MCP ●", w - 90, 347); x.textAlign = "left"; }
      searchT.tex.needsUpdate = true;
    }
    function drawBoard() {
      var x = boardT.x, w = 900, h = 500;
      x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, w, h);
      var hand = state.fontReady ? '"Gaegu", ' + UI : UI;
      x.fillStyle = "#C8473A"; x.font = "700 46px " + hand; x.textBaseline = "middle"; x.fillText("오늘의 작전판", 40, 54);
      x.strokeStyle = "#E3E6EA"; x.setLineDash([10, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(40, 92); x.lineTo(w - 40, 92); x.stroke(); x.setLineDash([]);
      var items = state.plan.length ? state.plan : null;
      if (!items) { x.fillStyle = "#A2AAB4"; x.font = "400 36px " + hand; x.fillText("계획이 생기면 여기에 적어요", 40, 150); }
      else items.slice(0, 7).forEach(function (it, i) {
        var y = 140 + i * 50;
        var done = it.status === "completed", doing = it.status === "in_progress";
        x.strokeStyle = done ? "#1D8A4F" : doing ? "#C8473A" : "#1E3A8A"; x.lineWidth = 3;
        x.strokeRect(42, y - 15, 30, 30);
        if (done) { x.beginPath(); x.moveTo(48, y); x.lineTo(56, y + 9); x.lineTo(70, y - 12); x.stroke(); }
        if (doing) { x.fillStyle = "#C8473A"; x.beginPath(); x.moveTo(50, y - 9); x.lineTo(66, y); x.lineTo(50, y + 9); x.fill(); }
        x.fillStyle = done ? "#9AA3AE" : doing ? "#C8473A" : "#1E3A8A";
        x.font = (doing ? "700 " : "400 ") + "36px " + hand;
        var s = clipText(x, it.text, w - 140); x.fillText(s, 90, y + 2);
        if (done) { x.strokeStyle = "#9AA3AE"; x.lineWidth = 2; x.beginPath(); x.moveTo(90, y + 2); x.lineTo(90 + x.measureText(s).width, y + 2); x.stroke(); }
      });
      boardT.tex.needsUpdate = true;
    }
    function redrawAll() { drawCode(); drawTerm(); drawSearch(); drawBoard(); }
    redrawAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { state.fontReady = true; redrawAll(); });

    // ---------- 러너 이동 ----------
    var path = [], runnerRoom = "lounge", onArrive = null;
    function roomOfPoint(x, z) {
      if (Math.abs(z) < 1.25) return "lounge";
      for (var k in ROOMS) { var R = ROOMS[k]; if (Math.abs(x - R.cx) <= 3 && Math.abs(z - R.cz) <= 2.5) return k; }
      return "lounge";
    }
    function walkTo(room, instant) {
      var s = SPOT[room];
      if (!s) return;
      if (instant) { path = []; runner.position.set(s[0], 0.08, s[1]); runnerRoom = room; runner.rotation.y = Math.PI / 4; return; }
      if (room === runnerRoom && !path.length) return;
      var p = runner.position, from = roomOfPoint(p.x, p.z);
      path = [];
      if (from !== room) {
        if (from !== "lounge") path.push(V(ROOMS[from].cx, 0.08, 0));
        if (room !== "lounge") path.push(V(ROOMS[room].cx, 0.08, 0));
      }
      path.push(V(s[0], 0.08, s[1]));
      runnerRoom = room;
      onArrive = room === "lounge" ? kick : null;
    }
    function kick() { kickT = 0; }

    // ---------- 애니메이션 ----------
    var clock = new T.Clock(), tAcc = 0, slow = 0, proj = V(0, 0, 0);
    var ledColor = new T.Color(), RED = new T.Color("#FF4D4F"), OFF = new T.Color("#1B2230");
    var flyT = 0;

    function animChar(c, dt, mode) {
      var u = c.userData; u.t += dt;
      var t = u.t;
      var legA = 0, armA = 0, armL = 0, armR = 0, bob = 0, nod = 0;
      if (mode === "walk") {
        legA = Math.sin(t * 11) * 0.55; armA = -legA * 0.8; bob = Math.abs(Math.sin(t * 11)) * 0.05;
        armL = armA; armR = -armA;
      } else if (mode === "busy") {
        armL = -0.9 + Math.sin(t * 22) * 0.18; armR = -0.9 + Math.sin(t * 22 + 1.6) * 0.18; nod = Math.sin(t * 5) * 0.06;
        bob = Math.abs(Math.sin(t * 5)) * 0.01;
      } else {
        bob = Math.sin(t * 2) * 0.008; armL = Math.sin(t * 2) * 0.03; armR = -armL;
      }
      if (u.seated) { u.legL.rotation.x = -1.45; u.legR.rotation.x = -1.45; u.body.position.y = -0.22 + bob; }
      else { u.legL.rotation.x = legA; u.legR.rotation.x = -legA; u.body.position.y = bob; }
      if (u.mug && u.mug.visible && mode !== "walk") armR = -1.1 + Math.sin(t * 1.3) * 0.08;
      u.armL.rotation.x = armL; u.armR.rotation.x = armR;
      u.head.rotation.x = nod;
      u.head.rotation.z = mode === "think" ? Math.sin(t * 1.5) * 0.08 : 0;
      if (u.sweat.visible) { u.sweat.position.y = -((t * 0.25) % 0.12); }
    }

    function frame() {
      var dt = Math.min(0.05, clock.getDelta());
      tAcc += dt;

      // 러너 걷기
      var moving = false;
      if (path.length) {
        var tgt = path[0], p = runner.position;
        var dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz), step = 4.6 * dt;
        if (d <= step) { p.x = tgt.x; p.z = tgt.z; path.shift(); if (!path.length && onArrive) { onArrive(); onArrive = null; } }
        else { p.x += dx / d * step; p.z += dz / d * step; }
        if (d > 0.01) { var want = Math.atan2(dx, dz); runner.rotation.y += angleDiff(want, runner.rotation.y) * Math.min(1, dt * 12); }
        moving = true;
      } else {
        runner.rotation.y += angleDiff(Math.PI / 4, runner.rotation.y) * Math.min(1, dt * 5);
      }
      animChar(runner, dt, moving ? "walk" : state.runnerMode || "idle");
      Object.keys(STAFF).forEach(function (room) { animChar(people[room], dt, state.busy === room ? "busy" : "idle"); });

      // 방 불빛
      Object.keys(rooms).forEach(function (k) {
        var r = rooms[k], want = state.active === k ? 1 : 0;
        r.on += (want - r.on) * Math.min(1, dt * 4);
        r.fail = Math.max(0, r.fail - dt);
        r.glow.intensity = r.on * 9;
        var e = r.floorMat.emissive;
        if (r.fail > 0) e.setRGB(0.35 * (0.5 + 0.5 * Math.sin(tAcc * 20)), 0, 0);
        else e.setRGB(0.12 * r.on, 0.09 * r.on, 0.02 * r.on);
        chips[k].classList.toggle("on", want === 1);
      });

      // 서버 LED: 명령이 돌면 빨라진다
      var speed = state.active === "server" ? 9 : 1;
      for (var i = 0; i < ledInfo.length; i++) {
        var L = ledInfo[i], on = Math.sin(tAcc * L.rate * speed * 3 + L.phase) > -0.2;
        ledColor.copy(rooms.server.fail > 0 ? RED : on ? L.color : OFF);
        leds.setColorAt(i, ledColor);
      }
      leds.instanceColor.needsUpdate = true;

      // 소품 움직임
      globe.rotation.y += dt * (state.active === "search" ? 2.4 : 0.25);
      books.forEach(function (b, i) { b.position.z = b.userData.baseZ + (state.active === "library" ? Math.max(0, Math.sin(tAcc * 3 + i)) * 0.12 : 0); });
      if (state.active === "library") {
        flyT = (flyT + dt * 0.55) % 1; flyBook.visible = true;
        flyBook.position.set(-1.2 + flyT * 2.2, 1.0 + Math.sin(flyT * Math.PI) * 0.9, -1.6 + flyT * 1.9);
        flyBook.rotation.set(flyT * 6, flyT * 3, 0);
      } else flyBook.visible = false;
      steam.forEach(function (s, i) { var ph = (tAcc * 0.5 + i * 0.5) % 1; s.position.y = 0.98 + ph * 0.3; s.material.opacity = 0.5 * (1 - ph); });
      plugs.forEach(function (m, i) { m.emissive.set(state.mcp ? (Math.sin(tAcc * 6 + i) > 0 ? "#3DDC84" : "#145C35") : "#000000"); });
      flag.rotation.y = Math.sin(tAcc * 2) * 0.12;
      if (kickT >= 0) {
        kickT += dt;
        var kt = Math.min(1, kickT / 0.7);
        soccer.position.set(ballHome.x + kt * 1.1, 0.17 + Math.sin(kt * Math.PI) * 0.35, ballHome.z - kt * 0.85);
        soccer.rotation.x -= dt * 12;
        if (kickT > 2.2) { kickT = -1; soccer.position.copy(ballHome); }
      }
      // 엘리베이터 문
      state.evCur = (state.evCur || 0) + ((state.evOpen || 0) - (state.evCur || 0)) * Math.min(1, dt * 5);
      var dOpen = state.evCur;
      doorL.position.z = -0.38 - dOpen * 0.7; doorR.position.z = 0.38 + dOpen * 0.7;

      // 화면 다시 그리기 (10~20fps)
      slow += dt;
      if (slow > 0.06) {
        slow = 0;
        if (state.active === "dev") { codeScroll += 6; drawCode(); }
        if (state.active === "server") drawTerm();
        if (state.active === "search") drawSearch();
      }

      // 카메라
      view.az += (view.azTarget - view.az) * Math.min(1, dt * 6);
      placeCam();
      renderer.render(scene, cam);

      // 오버레이 위치
      for (var j = 0; j < ov.length; j++) {
        var it = ov[j];
        if (it.follow) proj.set(it.follow.position.x, it.follow.position.y + it.dy, it.follow.position.z);
        else proj.copy(it.pos);
        proj.project(cam);
        it.el.style.transform = "translate3d(" + ((proj.x + 1) / 2 * W).toFixed(1) + "px," + ((1 - proj.y) / 2 * H).toFixed(1) + "px,0)" + it.anchor;
      }
      requestAnimationFrame(frame);
    }
    function angleDiff(a, b) { var d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
    requestAnimationFrame(frame);

    // ---------- office.js에 내주는 손잡이 ----------
    function who(k) { return k === "me" ? people.desk : k === "runner" ? runner : people[k]; }
    return {
      host: function (k) { return hosts[k === "me" ? "desk" : k]; },
      setActive: function (room) { state.active = room; drawTerm(); drawSearch(); drawCode(); },
      setBusy: function (room) { state.busy = room; },
      setRunnerMode: function (mode) { state.runnerMode = mode; runner.userData.mug.visible = mode === "idle"; },
      setRunnerVisible: function (v) { runner.visible = v; hosts.runner.style.display = v ? "" : "none"; hosts.runner._tag.style.display = v ? "" : "none"; },
      walkTo: walkTo,
      sweat: function (k, ms) {
        var c = who(k); if (!c) return;
        c.userData.sweat.visible = true;
        clearTimeout(c.userData.swT);
        c.userData.swT = setTimeout(function () { c.userData.sweat.visible = false; }, ms);
      },
      failFlash: function (room) { if (rooms[room]) rooms[room].fail = 1.4; },
      setCounts: function (stats) {
        Object.keys(chips).forEach(function (k) { chips[k].querySelector(".n").textContent = stats && stats[k] ? "×" + stats[k] : ""; });
      },
      setFile: function (name) { fileCard.querySelector(".v").textContent = name || "—"; fileCard.classList.toggle("show", !!name); },
      setCode: function (file, lines) { state.file = file; state.code = lines || []; codeScroll = 0; drawCode(); },
      setCommand: function (cmd, git) { state.command = cmd; state.git = !!git; gitBadge.classList.toggle("show", !!git && state.active === "server"); drawTerm(); },
      setQuery: function (q, mcp) { state.query = q; state.mcp = !!mcp; drawSearch(); },
      setPlan: function (items) { state.plan = items || []; drawBoard(); },
      setQuestion: function (q) {
        askCard.classList.toggle("show", !!q);
        alertEl.classList.toggle("show", !!q);
        if (!q) return;
        askCard.querySelector(".q").textContent = q.text;
        askCard.querySelector(".opts").innerHTML = (q.options || []).map(function (o) { var s = document.createElement("span"); s.textContent = o; return s.outerHTML; }).join("");
      },
      setFloor: function (n, arrow) { drawEv(n, arrow); },
      elevatorDoors: function (open) { state.evOpen = open; },
      snapshot: C.snapshot
    };
  }

  root.Office3D = { create: create, ROOMS: ROOMS };
})(typeof self !== "undefined" ? self : this);
