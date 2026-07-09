/**
 * 레디 셋 벳 핵심 데이터.
 * 배당률(m = 배수)과 실패 패널티(p = 지불 금액)는 실물 보드 기준으로 조정 가능.
 * 여기 정의된 p 값 일부는 근사치이므로 실물 보드를 보고 맞춰 주세요.
 */

export const FINISH_LINE = 15;   // 결승선 칸
export const RED_LINE = 9;       // 이 칸 이상을 밟은 말이 3마리면 베팅 마감
export const TRACK_LENGTH = 16;  // 0(출발) ~ 15(결승)
export const TOTAL_ROUNDS = 4;
export const START_MONEY = 0;
export const DEFAULT_ROLL_MS = 2500; // 하우스(시스템) 주사위 굴림 간격

// 주의: 말 ID에는 '/' 문자를 쓰지 않는다. Firebase RTDB 경로/키에서 '/'는
// 구분자로 해석되어 데이터가 엉뚱한 위치에 쓰이는 문제가 생긴다 (2/3, 11/12 말이
// 안 움직이던 버그의 원인). 표시용 텍스트는 아래 HORSES[].label을 사용한다.
export const HORSE_IDS = ['2_3', '4', '5', '6', '7', '8', '9', '10', '11_12'];

// 주사위 합 -> 경주마 매핑
export function sumToHorse(sum) {
  if (sum === 2 || sum === 3) return '2_3';
  if (sum === 11 || sum === 12) return '11_12';
  return String(sum);
}

export const HORSES = {
  '2_3':   { color: 'blue',   bonus: 3, label: '2/3' },
  '4':     { color: 'blue',   bonus: 3, label: '4' },
  '5':     { color: 'orange', bonus: 2, label: '5' },
  '6':     { color: 'red',    bonus: 1, label: '6' },
  '7':     { color: 'gray',   bonus: 0, label: '7' },
  '8':     { color: 'red',    bonus: 1, label: '8' },
  '9':     { color: 'orange', bonus: 2, label: '9' },
  '10':    { color: 'blue',   bonus: 3, label: '10' },
  '11_12': { color: 'blue',   bonus: 3, label: '11/12' },
};

// 행별 배당판. win 3칸 / place 2칸 / show 2칸 (왼쪽->오른쪽).
const ROW = (win, place, show) => ({ win, place, show });
export const BOARD = {
  '2_3':   ROW([{m:7,p:2},{m:8,p:2},{m:9,p:2}], [{m:5,p:2},{m:5,p:1}], [{m:4,p:2},{m:4,p:1}]),
  '4':     ROW([{m:5,p:2},{m:6,p:2},{m:7,p:2}], [{m:4,p:2},{m:4,p:1}], [{m:3,p:2},{m:3,p:1}]),
  '5':     ROW([{m:4,p:3},{m:4,p:2},{m:5,p:2}], [{m:2,p:1},{m:3,p:2}], [{m:2,p:2},{m:2,p:1}]),
  '6':     ROW([{m:3,p:3},{m:3,p:2},{m:3,p:1}], [{m:2,p:2},{m:2,p:1}], [{m:1,p:1},{m:1,p:0}]),
  '7':     ROW([{m:3,p:4},{m:3,p:3},{m:3,p:2}], [{m:2,p:2},{m:2,p:1}], [{m:1,p:1},{m:1,p:0}]),
  '8':     ROW([{m:3,p:3},{m:3,p:2},{m:3,p:1}], [{m:2,p:2},{m:2,p:1}], [{m:1,p:1},{m:1,p:0}]),
  '9':     ROW([{m:4,p:3},{m:4,p:2},{m:5,p:2}], [{m:2,p:1},{m:3,p:2}], [{m:2,p:2},{m:2,p:1}]),
  '10':    ROW([{m:5,p:2},{m:6,p:2},{m:7,p:2}], [{m:4,p:2},{m:4,p:1}], [{m:3,p:2},{m:3,p:1}]),
  '11_12': ROW([{m:7,p:2},{m:8,p:2},{m:9,p:2}], [{m:5,p:2},{m:5,p:1}], [{m:4,p:2},{m:4,p:1}]),
};

// 컬러 베팅 (좌측 특수 칸)
export const COLOR_BETS = {
  blueWins:   { label: '푸른색 우승', m: 5, p: 1, check: (ranks) => HORSES[winnerOf(ranks)].color === 'blue' },
  orangeWins: { label: '주황색 우승', m: 3, p: 1, check: (ranks) => HORSES[winnerOf(ranks)].color === 'orange' },
  redWins:    { label: '붉은색 우승', m: 2, p: 1, check: (ranks) => HORSES[winnerOf(ranks)].color === 'red' },
  seven5th:   { label: '7번 5위 이하', m: 4, p: 0, check: (ranks) => (ranks['7'] ?? 99) >= 5 },
};
function winnerOf(ranks) {
  return Object.keys(ranks).find((h) => ranks[h] === 1);
}

// 플레이어 기본 베팅 토큰 (7~8인 게임이면 3 하나 제거)
export const DEFAULT_TOKENS = [
  { id: 't2', value: 2 },
  { id: 't3a', value: 3 },
  { id: 't3b', value: 3 },
  { id: 't4', value: 4 },
  { id: 't5', value: 5 },
];

export const PLAYER_COLORS = [
  '#7C3AED', '#DC2626', '#0891B2', '#D97706',
  '#16A34A', '#DB2777', '#4B5563', '#B45309',
];

/**
 * VIP 카드 풀 (간소화 버전).
 * type:
 *  - bonusToken: 보너스 베팅 토큰 획득 { value, penalty, negate(패널티 무효 기호 여부) }
 *  - freeChips: 매 라운드 시작 시 $amount 지급
 *  - shield: 매 라운드 실패 패널티 합계에서 최대 $amount 경감
 *  - snakeBox: 1-1 또는 6-6이 나올 때마다 $amount 획득
 */
export const VIP_POOL = [
  { id: 'bt7', type: 'bonusToken', name: '보너스 토큰 7', value: 7, penalty: 5, negate: false },
  { id: 'bt6', type: 'bonusToken', name: '보너스 토큰 6', value: 6, penalty: 3, negate: false },
  { id: 'bt5', type: 'bonusToken', name: '보너스 토큰 5', value: 5, penalty: 2, negate: false },
  { id: 'bt4', type: 'bonusToken', name: '보너스 토큰 4', value: 4, penalty: 1, negate: false },
  { id: 'bt3', type: 'bonusToken', name: '보너스 토큰 3', value: 3, penalty: 0, negate: false },
  { id: 'bt2', type: 'bonusToken', name: '보너스 토큰 2 (패널티 무효)', value: 2, penalty: 0, negate: true },
  { id: 'chips3', type: 'freeChips', name: '무료 제공 칩 $3', amount: 3 },
  { id: 'chips5', type: 'freeChips', name: '무료 제공 칩 $5', amount: 5 },
  { id: 'shield3', type: 'shield', name: '패널티 경감 $3', amount: 3 },
  { id: 'shield5', type: 'shield', name: '패널티 경감 $5', amount: 5 },
  { id: 'snake2', type: 'snakeBox', name: '스네이크 아이즈 & 박스카 $2', amount: 2 },
  { id: 'snake3', type: 'snakeBox', name: '스네이크 아이즈 & 박스카 $3', amount: 3 },
];
