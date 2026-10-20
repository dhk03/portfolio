# DH 타워 오피스

Claude Code가 남기는 세션 기록(`~/.claude/projects/**/*.jsonl`)을 0.25초마다 따라 읽어서, 3D 아이소메트릭 사무실의 캐릭터를 움직이는 페이지입니다.
사무실 직원은 모두 저(김동환)의 분신입니다. 얼굴은 같고, 그동안 해 온 일에 맞춰 옷만 다릅니다.

## 실행

```bash
cd office
node server.js          # 실제 세션 기록 → http://127.0.0.1:4317
node server.js --demo   # 가상 세션 기록을 임시 폴더에 쓰면서 시연
```

서버는 외부 패키지 없이 돌아갑니다(Node 18 이상). 3D는 `vendor/`에 넣어 둔 Three.js r158을 써서 인터넷 없이도 열립니다.

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `4317` | 포트 |
| `HOST` | `127.0.0.1` | 세션 기록이 보이므로 기본은 내 컴퓨터에서만 열림 |
| `CLAUDE_PROJECTS` | `~/.claude/projects` | 읽을 세션 기록 폴더 |
| `OFFICE_MAX_AGE_HOURS` | `72` | 이보다 오래 손대지 않은 세션은 빌딩에서 뺌 |

서버 없이 `index.html`을 열거나 GitHub Pages(`/portfolio/office/`)에서 열면 브라우저 안에서 데모가 돌아갑니다.

## 앱으로 설치 (PWA)

서버를 켠 상태로 크롬이나 엣지에서 http://127.0.0.1:4317 을 열고, 오른쪽 위 **⬇︎ 앱으로 설치** 버튼을 누르거나 주소창 오른쪽의 설치 아이콘을 누르세요.
주소창 없는 별도 창으로 열리고, 시작 메뉴와 작업 표시줄에 고정할 수 있습니다.

- 서버(`node server.js`)는 계속 켜 두어야 실제 세션이 보입니다. 서버가 꺼져 있으면 앱은 데모로 열립니다.
- 화면 파일은 캐시하지만 실시간 데이터(`/events`, `/state`)는 캐시하지 않습니다.

## Claude Code 상태줄

```bash
node statusline.js --install     # ~/.claude/settings.json 에 등록 (기존 설정은 settings.json.bak-office 로 백업)
node statusline.js --uninstall   # 해제, 원래 상태줄이 있었다면 되돌림
```

Claude Code를 새로 열면 입력창 아래에 이렇게 보입니다.

```
🏢 1F portfolio │ ● 🗄️ 서버실 · 클로드 동환 Bash npm test │ 🗒️ 작전판 2/5 │ 💦 실패 1
```

- 상태줄은 그 세션의 기록을 직접 읽어서 오피스와 같은 규칙으로 계산합니다. 그래서 서버가 꺼져 있어도 동작합니다.
- 서버가 켜져 있으면 몇 층인지(`1F`)가 붙습니다.
- 상태: `●` 작업, `💭` 생각, `🙋` 질문, `💦` 실패, `☕` 쉬는 중
- 서버 포트를 바꿨다면 `OFFICE_PORT` 환경 변수로 알려 주세요.

## 방 배치

| 방 | 담당자 | 도구 |
| --- | --- | --- |
| 📚 자료실 | 검수관 동환 — K리그 기록원 운영·기록 검수. 헤드셋, 형광 조끼, 기록지 클립보드 | `Read` `Grep` `Glob` |
| 💻 개발실 | 랩 개발자 동환 — 데이터 랩·선발 명단 검증 도구. 피치색 후드, 헤드폰 | `Edit` `Write` `MultiEdit` (아이맥 화면에 고친 코드가 흐름) |
| 🗄️ 서버실 | 현장소장 동환 — DB 조회·Slack 알림 자동화. 안전모, 반사띠 작업복 | `Bash` 등 (돌리는 동안 랙 불빛이 빨라지고, git이면 배지가 뜸) |
| 🌐 정보검색실 | 전력분석관 동환 — 리서치·스킬 큐레이션. 트랙 재킷, 거꾸로 쓴 캡, 쌍안경 | `WebSearch` `WebFetch` `mcp__*` |
| 🗒️ 회의실 | 기획실장 동환 — 제안·견적·계약. 블레이저, 금색 넥타이 | `TodoWrite` `Task*` `ExitPlanMode` `Agent` (화이트보드 '작전판'에 계획을 적음) |
| 🧑‍💻 내 자리 | 김동환 — 주장 #10 유니폼 | `AskUserQuestion` 이면 클로드 동환이 내 책상까지 찾아옴 |

세션마다 **클로드 동환**(주황 유니폼 #00) 한 명이 일감에 따라 방을 옮겨 다닙니다.

- 생각할 때: 구름 말풍선에 생각 요약
- 도구가 실패하면: 식은땀 + 빨간 말풍선, 그 방 담당자도 같이 당황
- 내가 지시하면: 내 자리에서 초록 말풍선
- 할 일이 끝나면: 라운지로 돌아가 커피를 마시고 미니 골대에 공을 참

생김새는 `characters3d.js`의 `BASE`(피부·머리 색, 머리 모양, 안경)만 바꾸면 모든 직원에게 반영됩니다.

사무실은 드래그하면 좌우로 살짝 돌아가고, 더블클릭하면 원래 각도로 돌아옵니다.

## 층과 매장

- 프로젝트 하나 = 한 층. 처음 기록이 생긴 순서대로 1F, 2F, 3F…
- 세션 하나 = 그 층의 매장. 왼쪽 층별 안내에 최근 순으로 최대 8곳
- 지금 일하는 층엔 초록불, 층을 누르면 엘리베이터 문이 닫히고 `▲ 3F` 표시등이 한 층씩 올라감
- **자동 따라가기**가 켜져 있으면 `/clear`로 새 세션이 생겼을 때 같은 층의 새 매장으로 따라감

## 구조

```
office/
├── server.js        # jsonl tail(0.25초) + SSE(/events) + 정적 파일
├── core/state.js    # 기록 한 줄 → 사무실 상태(서버·브라우저 공용)
├── core/demo.js     # 데모 시나리오(실제와 같은 모양의 jsonl 레코드)
├── index.html
├── office.css
├── office.js        # SSE를 받아 화면을 그림, 서버가 없으면 데모로 전환
├── scene3d.js       # Three.js 사무실(방·소품·화면 텍스처·말풍선 위치)
├── characters3d.js  # 직원 3D 모델
├── statusline.js    # Claude Code 상태줄 (--install / --uninstall)
├── manifest.webmanifest, sw.js, icons/   # 앱으로 설치(PWA)
└── vendor/          # three.min.js r158, RoundedBoxGeometry (MIT)
```

SSE 이벤트

- `hello` — `{ mode: "live" | "demo", root }`
- `snapshot` — 층·매장·세션 상태 전체. 바뀔 때만 보냄
- `fx` — 말풍선용 순간 이벤트. `kind`: `prompt` `think` `tool` `fail` `say` `done`

`GET /state`로 지금 상태를 JSON으로 볼 수도 있습니다.
