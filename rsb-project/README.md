# 레디 셋 벳 온라인 (Ready Set Bet Web)

실시간 멀티플레이어 경마 베팅 게임. React + Vite + Firebase Realtime Database.

> 개인/친구용 팬 구현입니다. 공개 서비스로 배포할 경우 원작(AEG)의 아트워크·카드 문구·로고는 사용하지 말고 자체 에셋을 쓰세요. 이 프로젝트는 규칙 로직만 구현하며 원작 이미지를 포함하지 않습니다.

---

## 1단계. Realtime Database 구조 설계

### JSON 스키마

```jsonc
{
  "rooms": {
    "KX7Q2": {                          // 5자리 방 코드 (혼동 문자 제외)
      "meta": {
        "hostUid": "abc123",            // 하우스 = 방 생성자. 경주 상태의 '단일 작성자'
        "status": "lobby",              // lobby | racing | vip | finished
        "round": 1,                     // 1 ~ 4
        "rollMs": 2500,                 // 하우스 주사위 굴림 간격(ms)
        "createdAt": 1720000000000
      },

      "players": {
        "abc123": {
          "name": "동훈",
          "color": "#7C3AED",
          "money": 12,
          "tokens": {                   // 기본 베팅 토큰 5개 (7~8인이면 4개)
            "t2":  { "value": 2, "used": false },
            "t3a": { "value": 3, "used": true },
            "t3b": { "value": 3, "used": false },
            "t4":  { "value": 4, "used": false },
            "t5":  { "value": 5, "used": false }
          },
          "bonusTokens": {              // VIP 카드로 얻는 보너스 토큰
            "bt7": { "value": 7, "penalty": 5, "negate": false, "used": false }
          },
          "vipCards": [ { "id": "chips3", "type": "freeChips", "amount": 3 } ]
        }
      },

      "race": {
        "horses": {
          "2_3":  { "position": 4 },    // 0(출발) ~ 15(결승). 키의 '/'는 '_'로 치환
          "7":    { "position": 9 }
        },
        "lastRoll": {                   // 모든 클라이언트가 구독해 애니메이션 재생
          "d1": 3, "d2": 4, "sum": 7,
          "horseId": "7", "bonus": 0,
          "seq": 41, "ts": 1720000123456
        },
        "prevHorse": "7",               // 연속 굴림 보너스 판정용
        "armed": true,                  // '새 쌍의 첫 굴림' 상태 플래그
        "bettingLocked": false,         // 붉은 선 3마리 통과 시 true
        "finished": {                   // 결승선 도달 시 기록
          "winnerId": "5",
          "ranks": { "5": 1, "7": 2, "8": 2, "4": 4 }   // 공동 순위 지원
        },
        "bets": {
          // 셀 키 = "종류|말번호|칸번호"  (원본 ID "win:2/3:0" 를 RTDB 키로 치환)
          "win|2_3|0": {
            "uid": "abc123",
            "tokenId": "t5",
            "value": 5,
            "tokenPenalty": 0,
            "negate": false,
            "cellId": "win:2/3:0",      // 정산 시 사용하는 원본 셀 ID
            "ts": 1720000111222
          }
        }
      },

      "vip": {                          // 라운드 1~3 종료 후
        "abc123": { "offered": [ {...}, {...} ], "picked": "bt5" }
      },

      "results": {                      // 라운드별 정산 기록
        "1": { "abc123": { "gain": 15, "loss": 2, "delta": 13, "newMoney": 13 } }
      }
    }
  }
}
```

### 동시 베팅 선착순 처리 — Firebase Transaction

베팅 칸 하나가 곧 하나의 노드(`race/bets/{cellKey}`)입니다. 두 명이 동시에 같은
칸을 클릭해도 **트랜잭션이 `null`일 때만 커밋**하므로 정확히 한 명만 성공합니다.

```js
const result = await runTransaction(cellRef, (cur) => {
  if (cur !== null) return;   // 이미 누가 선점 → undefined 반환 = 트랜잭션 중단
  return { uid, tokenId, value, cellId, ts: Date.now() };
});
if (!result.committed) throw new Error('다른 플레이어가 먼저 베팅한 칸입니다.');
```

토큰 소모(`players/{uid}/tokens/{tokenId}/used = true`)는 셀 선점 **성공 후**에만
기록합니다. 토큰 경로는 본인만 쓰므로 추가 트랜잭션이 필요 없습니다.

### 경주 상태 동기화 — 단일 작성자(하우스) 패턴

주사위 굴림·말 이동·마감·정산은 전부 **호스트 클라이언트 하나만** 씁니다
(`App.jsx`의 setInterval 루프 → `houseRoll()`). 나머지 클라이언트는 `onValue`
구독으로 화면만 갱신하므로 쓰기 충돌이 원천적으로 없습니다. 보안 규칙에서도
`race` 경로 쓰기를 `hostUid`로 제한합니다(베팅 칸의 최초 기록만 예외).

> 호스트가 이탈하면 경주가 멈춥니다. 운영을 더 견고하게 하려면 Cloud Functions로
> 주사위 루프를 옮기는 것이 다음 단계입니다.

---

## 2단계. 프론트엔드 구성

```
src/
  App.jsx                  인증, 방 구독, 하우스 주사위 루프
  constants.js             경주마/배당판/컬러베팅/VIP 카드 데이터 (배당·패널티 조정은 여기)
  engine/
    dice.js                주사위 + 연속 굴림 보너스 판정 (3연속 예외 처리 포함)
    settlement.js          공동 순위 계산, 베팅 성공/실패 정산, VIP 효과
  hooks/roomActions.js     RTDB 액션 전부 (방/경주/베팅 트랜잭션/VIP/라운드)
  components/
    Lobby.jsx              방 생성·입장, 이름·색상 선택
    GameRoom.jsx           상태별 화면 조립
    RaceTrack.jsx          9개 레인, 붉은 선, 결승선, CSS transition 이동
    BettingBoard.jsx       Win/Place/Show 그리드 + 컬러 베팅, 토큰 선택→클릭 배치
    DicePanel.jsx          마지막 굴림, 보너스/스네이크아이즈 연출
    VipPicker.jsx          라운드 정산표 + VIP 2장 중 1장 선택
    ResultsModal.jsx       4라운드 후 최종 순위
```

배당판의 배수는 규칙서 이미지 기준이고, 실패 패널티 일부는 근사치입니다.
`constants.js`의 `BOARD` 값을 실물 보드에 맞게 수정하면 됩니다.
붉은 선 위치(`RED_LINE`), 굴림 간격(`DEFAULT_ROLL_MS`)도 같은 파일에서 조정합니다.

---

## 3단계. 설정 및 배포

### A. Firebase 프로젝트 준비

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Authentication** → 로그인 방법 → **익명** 사용 설정
3. **Realtime Database** → 데이터베이스 만들기 (지역: asia-southeast1 권장)
4. 규칙 탭에 이 리포지토리의 `database.rules.json` 내용 붙여넣기
   (또는 `firebase deploy --only database`)
5. 프로젝트 설정 → 내 앱(웹) 등록 → SDK 구성값 복사

### B. 로컬 실행

```bash
cp .env.example .env      # 복사한 SDK 값 입력
npm install
npm run dev
```

### C. API Key 보안에 대해

`.env`는 커밋하지 않지만, **웹앱의 Firebase API Key는 빌드 결과물에 포함되는 공개
식별자**입니다. 실제 보안은 (1) RTDB 보안 규칙, (2) 익명 인증 필수화,
(3) Firebase 콘솔 → Authentication → 설정 → **승인된 도메인**에 배포 도메인만
등록하는 것으로 확보합니다. 필요하면 Google Cloud 콘솔에서 API Key에
HTTP 리퍼러 제한을 추가하세요.

### D. GitHub Pages 자동 배포

1. GitHub 리포지토리 생성 후 push
2. Settings → Pages → Source: **GitHub Actions**
3. Settings → Secrets and variables → Actions에 시크릿 7개 등록
   (`FIREBASE_API_KEY` 등 — `.github/workflows/deploy.yml` 상단 주석 참조)
4. main에 push하면 자동 빌드·배포 →
   `https://<계정>.github.io/<리포지토리>/`

### E. Firebase Hosting으로 배포하려면 (선택)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # public 디렉터리: dist, SPA: yes
npm run deploy:firebase
```

---

## 게임 규칙 구현 체크리스트

- [x] 경주마 9마리 (2/3, 4~10, 11/12), 결승선 15칸
- [x] 주사위 합 → 해당 말 1칸 전진
- [x] 연속 굴림 보너스 (+1/+2/+3, 2/3·11/12는 두 숫자 모두 인정, 3연속은 미발동·새 쌍 시작)
- [x] 턴 없는 실시간 선착순 베팅 (트랜잭션 선점, 토큰 이동/회수 불가)
- [x] 붉은 선 3마리 통과 → 베팅 마감
- [x] 결승선 도달 → 즉시 종료, Win/Place/Show 공동 순위 판정
- [x] 정산: 성공 = 배수 × 토큰 숫자, 실패 = 칸 패널티 지불, 자산 0 미만 불가
- [x] 컬러 베팅 (푸른색/주황색/붉은색 우승, 7번 5위 이하)
- [x] 라운드 1~3 후 VIP 카드 2장 중 1장 선택 (보너스 토큰/무료 칩/패널티 경감/스네이크아이즈)
- [x] 4라운드 후 최다 자산 플레이어 승리 (동률 공동 우승)
- [ ] 프롭 베팅 카드 (확장 예정)
- [ ] 엑조틱 피니시 카드 (확장 예정)
- [ ] 하우스 베팅/교대 변형 규칙 (확장 예정)
