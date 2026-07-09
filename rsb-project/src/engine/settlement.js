import { BOARD, COLOR_BETS, HORSE_IDS } from '../constants.js';

/**
 * 경주 종료 시 순위 계산 (표준 경쟁 순위 방식).
 * winnerId는 결승선을 밟은 말. 나머지는 위치 내림차순.
 * 공동 순위 처리: 1,2,2,4 ... -> 공동 2위 두 마리는 2위이자 3위로 취급되어
 * show 판정(rank<=3)에 자연스럽게 부합하고, 그 다음 말(rank 4)은 쇼가 아님.
 */
export function computeRanks(horses, winnerId) {
  const rest = HORSE_IDS.filter((h) => h !== winnerId)
    .map((h) => ({ h, pos: horses[h]?.position ?? 0 }))
    .sort((a, b) => b.pos - a.pos);

  const ranks = { [winnerId]: 1 };
  let rank = 2;
  for (let i = 0; i < rest.length; i++) {
    if (i > 0 && rest[i].pos === rest[i - 1].pos) {
      ranks[rest[i].h] = ranks[rest[i - 1].h]; // 공동 순위
    } else {
      ranks[rest[i].h] = rank;
    }
    rank++;
  }
  return ranks;
}

/** 베팅 셀 ID 파싱: "win:2/3:0", "place:7:1", "show:4:0", "color:blueWins" */
export function parseCellId(cellId) {
  const parts = cellId.split(':');
  if (parts[0] === 'color') return { kind: 'color', key: parts[1] };
  return { kind: parts[0], horseId: parts[1], idx: Number(parts[2]) };
}

export function cellSpec(cellId) {
  const c = parseCellId(cellId);
  if (c.kind === 'color') {
    const cb = COLOR_BETS[c.key];
    return { m: cb.m, p: cb.p, label: cb.label };
  }
  const cell = BOARD[c.horseId][c.kind][c.idx];
  return { m: cell.m, p: cell.p };
}

function betSucceeds(cellId, ranks) {
  const c = parseCellId(cellId);
  if (c.kind === 'color') return COLOR_BETS[c.key].check(ranks);
  const r = ranks[c.horseId] ?? 99;
  if (c.kind === 'win') return r === 1;
  if (c.kind === 'place') return r <= 2;
  if (c.kind === 'show') return r <= 3;
  return false;
}

/**
 * 전체 베팅 정산.
 * @param {Object} bets  { cellId: { uid, tokenId, value, negate } }
 * @param {Object} ranks { horseId: rank }
 * @param {Object} players { uid: { money, vipCards? } }
 * @returns {Object} { uid: { gain, loss, delta, newMoney } }
 */
export function settleBets(bets, ranks, players) {
  const out = {};
  for (const uid of Object.keys(players)) {
    out[uid] = { gain: 0, loss: 0, delta: 0, newMoney: players[uid].money ?? 0 };
  }
  for (const [key, bet] of Object.entries(bets || {})) {
    const cellId = bet.cellId || key; // RTDB 키 정규화 대응: 원본 셀 ID 사용
    const spec = cellSpec(cellId);
    const acc = out[bet.uid];
    if (!acc) continue;
    if (betSucceeds(cellId, ranks)) {
      acc.gain += spec.m * bet.value;
    } else if (!bet.negate) {
      // 실패: 셀 패널티 + (보너스 토큰 자체 패널티)
      acc.loss += (spec.p ?? 0) + (bet.tokenPenalty ?? 0);
    }
  }
  for (const [uid, acc] of Object.entries(out)) {
    // VIP: 패널티 경감(shield)
    const shields = (players[uid].vipCards || []).filter((c) => c.type === 'shield');
    const relief = shields.reduce((s, c) => s + c.amount, 0);
    acc.loss = Math.max(0, acc.loss - relief);
    acc.delta = acc.gain - acc.loss;
    // 자산은 0 미만으로 내려가지 않음 (빚 없음)
    acc.newMoney = Math.max(0, (players[uid].money ?? 0) + acc.delta);
  }
  return out;
}
