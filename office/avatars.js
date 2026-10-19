/*
 * 오피스 사람들 — 전원 '동환'의 분신이다.
 * 얼굴·머리(BASE)는 같고, 그동안 해 온 일에 맞춰 옷과 소품만 다르다.
 * 생김새를 바꾸고 싶으면 BASE만 고치면 모든 캐릭터에 반영된다.
 */
(function (root) {
  "use strict";

  var BASE = {
    skin: "#F2CBA8",
    skinShade: "#E2AE88",
    hair: "#1E1A18",
    hairStyle: "side",   // side(옆 가르마) | crop(짧은 크롭) | wave(살짝 웨이브)
    glasses: false,      // 안경을 쓰면 true
    brows: "#1E1A18",
    ink: "#1C1714"
  };

  // 역할별 인물 설정 — 포트폴리오의 경력·작업에서 가져왔다
  var ROLES = {
    me: {
      name: "김동환", badge: "주장 #10", room: "desk",
      desc: "인천광역시축구협회 → 스포츠투아이 DX사업파트. 이 빌딩의 주인이자 주장.",
      top: "#1D5E40", trim: "#E8B21E", pants: "#F4F1E8", shoes: "#1C1714", socks: "#1D5E40", shorts: true
    },
    runner: {
      name: "클로드 동환", badge: "CC #00", room: "lounge",
      desc: "세션마다 한 명. 일이 생기면 그 방으로 뛰어간다.",
      top: "#D97757", trim: "#FFF4EC", pants: "#FFF4EC", shoes: "#3A2A22", socks: "#D97757", shorts: true
    },
    archivist: {
      name: "검수관 동환", badge: "기록 검수", room: "library",
      desc: "K리그 기록원 73명 운영·기록 데이터 검수. 원본과 숫자가 맞는지 먼저 본다.",
      top: "#F7F5EE", trim: "#D6E83A", pants: "#8C7A5B", shoes: "#3B2F25"
    },
    dev: {
      name: "랩 개발자 동환", badge: "데이터 랩", room: "dev",
      desc: "K리그 데이터 랩·선발 명단 검증 도구. Python, pandas, Three.js.",
      top: "#2F6E4F", trim: "#E8B21E", pants: "#3A3F47", shoes: "#F2F2F2"
    },
    server: {
      name: "현장소장 동환", badge: "DB·자동화", room: "server",
      desc: "PostgreSQL·MSSQL 조회, Slack 정기 알림 스케줄. 오류 연락 3회 → 0건.",
      top: "#26364F", trim: "#C9D3DE", pants: "#26364F", shoes: "#1C1714"
    },
    scout: {
      name: "전력분석관 동환", badge: "리서치", room: "search",
      desc: "경기 이벤트·일정 데이터 리서치, AI 디자인 스킬 큐레이션.",
      top: "#223C7A", trim: "#FFFFFF", pants: "#1A2B57", shoes: "#F2F2F2"
    },
    planner: {
      name: "기획실장 동환", badge: "제안·계약", room: "meeting",
      desc: "제안서·견적·계약 조율, 스토리보드와 기능 요구사항.",
      top: "#FFFFFF", trim: "#E8B21E", pants: "#5A6170", shoes: "#2A1E18", jacket: "#1E2B44"
    }
  };

  function hair(b) {
    var c = b.hair;
    if (b.hairStyle === "crop") return '<path d="M16 21C15 11 22 7 30 7s15 4 14 14c-3-4-7-6-14-6s-11 2-14 6z" fill="' + c + '"/>';
    if (b.hairStyle === "wave") return '<path d="M15 22C13 10 22 5 31 6c9 0 15 6 14 15-2-3-4-5-7-5 0 0-2 3-6 3s-4-3-4-3c-3 2-6 3-9 2-2 1-3 2-4 4z" fill="' + c + '"/>';
    return '<path d="M15.5 23C13.5 11 21 6 30.5 6 40 6 46.5 11.5 44.5 22c-1.5-4-4-6.5-7.5-7.5-3 3.5-10 4.5-17 3.5-2 1.2-3.5 3-4.5 5z" fill="' + c + '"/>' +
      '<path d="M37 14.5c-1 2.2-2.6 3.6-4.6 4.4" stroke="#3a3330" stroke-width="1" fill="none" stroke-linecap="round"/>';
  }

  function face(b) {
    var s = "";
    s += '<g class="eyes"><ellipse cx="24.5" cy="24.5" rx="1.7" ry="2.1" fill="' + b.ink + '"/><ellipse cx="35.5" cy="24.5" rx="1.7" ry="2.1" fill="' + b.ink + '"/></g>';
    s += '<path d="M22 20.3l4.5-.6M33.5 19.7l4.5.6" stroke="' + b.brows + '" stroke-width="1.4" stroke-linecap="round"/>';
    s += '<circle cx="21" cy="28.5" r="2.2" fill="#F08A7A" opacity=".35"/><circle cx="39" cy="28.5" r="2.2" fill="#F08A7A" opacity=".35"/>';
    s += '<path class="mouth" d="M27.5 30.2q2.5 2.3 5 0" stroke="' + b.ink + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
    if (b.glasses) s += '<g fill="none" stroke="' + b.ink + '" stroke-width="1.1"><circle cx="24.5" cy="24.5" r="3.8"/><circle cx="35.5" cy="24.5" r="3.8"/><path d="M28.3 24.3h3.4"/></g>';
    return s;
  }

  function sweat() {
    return '<g class="sweat"><path d="M46 12c1.6 2.4 2.4 3.8 2.4 5a2.4 2.4 0 0 1-4.8 0c0-1.2.8-2.6 2.4-5z" fill="#7CC4F2"/>' +
      '<path d="M13 17c1.2 1.8 1.8 2.8 1.8 3.7a1.8 1.8 0 0 1-3.6 0c0-.9.6-1.9 1.8-3.7z" fill="#7CC4F2"/></g>';
  }

  function legs(r) {
    var s = "";
    [21.5, 31].forEach(function (x, i) {
      var cls = i ? "leg-r" : "leg-l";
      if (r.shorts) {
        s += '<g class="' + cls + '"><rect x="' + (x + 1) + '" y="60" width="6" height="11" rx="2" fill="' + BASE.skin + '"/>' +
          '<rect x="' + (x + 0.5) + '" y="65" width="7" height="7" rx="1.5" fill="' + r.socks + '"/>' +
          '<rect x="' + (x - 0.5) + '" y="71" width="9" height="5" rx="2.2" fill="' + r.shoes + '"/></g>';
      } else {
        s += '<g class="' + cls + '"><rect x="' + x + '" y="57" width="7.5" height="16" rx="3" fill="' + r.pants + '"/>' +
          '<rect x="' + (x - 0.5) + '" y="71" width="9" height="5" rx="2.2" fill="' + r.shoes + '"/></g>';
      }
    });
    return s;
  }

  function arm(side, sleeve, extra) {
    var x = side === "l" ? 10 : 43;
    return '<g class="arm-' + side + '"><rect x="' + x + '" y="40" width="7" height="17" rx="3.5" fill="' + sleeve + '"/>' + (extra || "") +
      '<circle cx="' + (x + 3.5) + '" cy="58" r="3.4" fill="' + BASE.skin + '"/></g>';
  }

  function torso(fill) { return '<rect x="16" y="37" width="28" height="25" rx="8" fill="' + fill + '"/>'; }

  function outfit(key, r) {
    var b = "", over = "", armL = "", armR = "", head = "", behind = "", sleeve = r.top;
    switch (key) {
      case "me":
        b = torso(r.top) + '<path d="M26 37l4 5 4-5" fill="none" stroke="' + r.trim + '" stroke-width="2"/>' +
          '<text x="30" y="56" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui,sans-serif" fill="' + r.trim + '">10</text>' +
          '<rect x="16" y="58" width="28" height="7" rx="2" fill="' + r.pants + '"/>';
        armL = '<rect x="10" y="44" width="7" height="4" fill="' + r.trim + '"/><text x="13.5" y="47.4" text-anchor="middle" font-size="3.6" font-weight="900" font-family="system-ui" fill="#1D5E40">C</text>';
        break;
      case "runner":
        b = torso(r.top) + '<path d="M26 37l4 4 4-4" fill="none" stroke="' + r.trim + '" stroke-width="2"/>' +
          '<path d="M30 45l1.3 3.7 3.7 1.3-3.7 1.3L30 55l-1.3-3.7-3.7-1.3 3.7-1.3z" fill="' + r.trim + '"/>' +
          '<rect x="16" y="58" width="28" height="7" rx="2" fill="' + r.pants + '"/>';
        head = '<rect x="15" y="15.5" width="30" height="3.4" rx="1.7" fill="' + r.trim + '"/>'; // 머리띠
        break;
      case "archivist":
        b = torso(r.top) +
          '<path d="M16 45c0-5 2-8 6-8h3l-1 25h-8zM44 45c0-5-2-8-6-8h-3l1 25h8z" fill="' + r.trim + '"/>' +
          '<rect x="16" y="52" width="9" height="2" fill="#F7F5EE" opacity=".9"/><rect x="35" y="52" width="9" height="2" fill="#F7F5EE" opacity=".9"/>' +
          '<text x="20.5" y="49" text-anchor="middle" font-size="3.6" font-weight="900" font-family="system-ui" fill="#2B4136">기록</text>';
        head = '<path d="M15.5 25C14 9 46 9 44.5 25" fill="none" stroke="#2B2B2B" stroke-width="2.2"/>' +
          '<rect x="12.5" y="21" width="5" height="8" rx="2.4" fill="#2B2B2B"/><path d="M15 28c1 4 4 5.5 9 5" stroke="#2B2B2B" stroke-width="1.4" fill="none"/><circle cx="24.5" cy="33" r="1.4" fill="#2B2B2B"/>';
        armR = '<rect x="40" y="48" width="12" height="15" rx="1.5" fill="#9A6B3F" transform="rotate(-8 46 55)"/><rect x="42" y="51" width="8" height="10" fill="#fff" transform="rotate(-8 46 55)"/>' +
          '<path d="M43 53.5h6M43 56h5M43 58.5h6" stroke="#9AA6A0" stroke-width=".8" transform="rotate(-8 46 55)"/>';
        break;
      case "dev":
        behind = '<ellipse cx="30" cy="38" rx="11" ry="5" fill="#245A40"/>';
        b = torso(r.top) + '<path d="M27 39v9M33 39v9" stroke="#F2F2F2" stroke-width="1.2" stroke-linecap="round"/>' +
          '<rect x="22" y="52" width="16" height="7" rx="3" fill="#245A40"/>' +
          '<circle cx="39" cy="44" r="2.4" fill="' + r.trim + '"/><path d="M38 44l.8.8 1.6-1.6" stroke="#2F6E4F" stroke-width=".8" fill="none"/>';
        over = '<path d="M18 38c0 6 24 6 24 0" fill="none" stroke="#111" stroke-width="2.6"/><rect x="15.5" y="35" width="5" height="6.5" rx="2.2" fill="#111"/><rect x="39.5" y="35" width="5" height="6.5" rx="2.2" fill="#111"/>';
        break;
      case "server":
        b = torso(r.top) + '<rect x="16" y="48" width="28" height="3" fill="' + r.trim + '"/>' +
          '<path d="M30 37v25" stroke="#1A273A" stroke-width="1"/>' +
          '<path d="M26 38l4 7 4-7" fill="none" stroke="#E04F3F" stroke-width="1.2"/><rect x="27" y="52" width="6" height="7" rx="1" fill="#fff"/><rect x="28" y="53.5" width="4" height="1.5" fill="#26364F"/>';
        head = '<path d="M14 18c0-9 7-13 16-13s16 4 16 13z" fill="#F2B705"/><rect x="11" y="16.5" width="38" height="3.6" rx="1.8" fill="#E0A800"/><rect x="28.5" y="5.5" width="3" height="11" rx="1.2" fill="#E0A800"/>';
        armR = '<rect x="43" y="46" width="7" height="2.5" fill="' + r.trim + '"/>';
        armL = '<rect x="10" y="46" width="7" height="2.5" fill="' + r.trim + '"/>';
        break;
      case "scout":
        b = torso(r.top) + '<path d="M30 37v25" stroke="#C9D3DE" stroke-width="1"/><path d="M25 37l5 5 5-5" fill="none" stroke="#fff" stroke-width="1.6"/>' +
          '<path d="M30 42v4" stroke="#1C1714" stroke-width="1"/>' +
          '<g fill="#1C1714"><rect x="23" y="45" width="5.5" height="8" rx="2.2"/><rect x="31.5" y="45" width="5.5" height="8" rx="2.2"/><rect x="27" y="47" width="6" height="3"/></g>' +
          '<circle cx="25.7" cy="52.4" r="1.3" fill="#6AA9D8"/><circle cx="34.3" cy="52.4" r="1.3" fill="#6AA9D8"/>';
        armL = '<path d="M12 41v15M15 41v15" stroke="#fff" stroke-width="1"/>';
        armR = '<path d="M45 41v15M48 41v15" stroke="#fff" stroke-width="1"/>';
        head = '<path d="M15 19c0-9 7-13 15-13s15 4 15 13z" fill="#C8423B"/><rect x="40" y="16" width="10" height="3.4" rx="1.7" fill="#A8342E"/><circle cx="30" cy="6.5" r="1.6" fill="#A8342E"/>';
        break;
      case "planner":
        b = torso(r.top) +
          '<path d="M16 45c0-5 3-8 8-8l5 9-3 16H16zM44 45c0-5-3-8-8-8l-5 9 3 16h10z" fill="' + r.jacket + '"/>' +
          '<path d="M30 39l-2 3 2 14 2-14z" fill="' + r.trim + '"/><rect x="36" y="50" width="5" height="1.5" fill="#fff" opacity=".7"/>';
        sleeve = r.jacket;
        armR = '<rect x="47" y="51" width="2.5" height="10" rx="1" fill="#1D5E40" transform="rotate(25 48 56)"/>';
        break;
    }
    return { b: b, over: over, armL: armL, armR: armR, head: head, behind: behind, sleeve: sleeve };
  }

  function svg(key) {
    var r = ROLES[key];
    var o = outfit(key, r);
    return '<svg class="av" viewBox="0 0 60 80" aria-hidden="true">' +
      '<ellipse class="shadow" cx="30" cy="77" rx="14" ry="2.8" fill="#000" opacity=".16"/>' +
      '<g class="body">' +
      legs(r) + o.behind +
      arm("l", o.sleeve, o.armL) +
      '<rect x="26" y="33" width="8" height="6" fill="' + BASE.skinShade + '"/>' +
      o.b +
      arm("r", o.sleeve, o.armR) +
      '<g class="head"><circle cx="16" cy="24.5" r="3" fill="' + BASE.skin + '"/><circle cx="44" cy="24.5" r="3" fill="' + BASE.skin + '"/>' +
      '<ellipse cx="30" cy="22.5" rx="14" ry="13.2" fill="' + BASE.skin + '"/>' + hair(BASE) + face(BASE) + o.head + sweat() + '</g>' +
      o.over +
      '</g></svg>';
  }

  root.Avatars = { BASE: BASE, ROLES: ROLES, svg: svg };
})(typeof self !== "undefined" ? self : this);
