import {
  ref, set, get, update, runTransaction, serverTimestamp, onValue, remove,
  push, query, limitToLast,
} from 'firebase/database';
import { db } from '../firebase.js';
import {
  HORSE_IDS, DEFAULT_TOKENS, FINISH_LINE, RED_LINE, TOTAL_ROUNDS,
  START_MONEY, DEFAULT_ROLL_MS, VIP_POOL,
} from '../constants.js';
import { rollDice, resolveRoll } from '../engine/dice.js';
import { computeRanks, settleBets } from '../engine/settlement.js';

const roomRef = (code, path = '') => ref(db, `rooms/${code}${path ? '/' + path : ''}`);

// RTDB 키에는 '/'를 쓸 수 없으므로 셀 ID를 안전한 키로 변환 ("win:2/3:0" -> "win|2_3|0")
export const cellKey = (cellId) => cellId.replace(/\//g, '_').replace(/:/g, '|');

export function newRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function freshHorses() {
  const h = {};
  for (const id of HORSE_IDS) h[id] = { position: 0 };
  return h;
}

function freshTokens(playerCount) {
  // 7~8인 게임에서는 3번 토큰 하나를 빼고 시작
  const tokens = {};
  for (const t of DEFAULT_TOKENS) {
    if (playerCount >= 7 && t.id === 't3b') continue;
    tokens[t.id] = { value: t.value, used: false };
  }
  return tokens;
}

export async function createRoom(uid, name, color) {
  const code = newRoomCode();
  await set(roomRef(code), {
    meta: {
      hostUid: uid,
      status: 'lobby',
      round: 1,
      rollMs: DEFAULT_ROLL_MS,
      createdAt: serverTimestamp(),
    },
    players: {
      [uid]: { name, color, money: START_MONEY, joinedAt: serverTimestamp() },
    },
  });
  return code;
}

export async function joinRoom(code, uid, name, color) {
  const snap = await get(roomRef(code, 'meta'));
  if (!snap.exists()) throw new Error('존재하지 않는 방 코드입니다.');
  if (snap.val().status !== 'lobby') throw new Error('이미 시작된 게임입니다.');
  await update(roomRef(code, `players/${uid}`), {
    name, color, money: START_MONEY, joinedAt: serverTimestamp(),
  });
}

/** 하우스(호스트 클라이언트)가 라운드 경주를 시작 */
export async function startRace(code) {
  const playersSnap = await get(roomRef(code, 'players'));
  const playerCount = Object.keys(playersSnap.val() || {}).length;
  const updates = {
    'meta/status': 'racing',
    race: {
      horses: freshHorses(),
      bettingLocked: false,
      prevHorse: null,
      armed: false,
      seq: 0,
    },
  };
  // 각 플레이어 토큰 리셋 (보너스 토큰은 VIP 카드에서 파생)
  for (const uid of Object.keys(playersSnap.val() || {})) {
    updates[`players/${uid}/tokens`] = freshTokens(playerCount);
  }
  await update(roomRef(code), updates);
}

/**
 * 하우스 주사위 1회 굴림 + 이동 + 마감/종료 판정.
 * 호스트 클라이언트만 주기적으로 호출한다 (경주 상태의 단일 작성자).
 */
export async function houseRoll(code) {
  const raceSnap = await get(roomRef(code, 'race'));
  const race = raceSnap.val();
  if (!race || race.finished) return;

  const { d1, d2, sum } = rollDice();
  const { horseId, bonus, nextPrev, nextArmed } = resolveRoll(race.prevHorse ?? null, !!race.armed, sum);

  const cur = race.horses[horseId]?.position ?? 0;
  const nextPos = Math.min(FINISH_LINE, cur + 1 + bonus);

  const updates = {
    [`horses/${horseId}/position`]: nextPos,
    lastRoll: { d1, d2, sum, horseId, bonus, seq: (race.seq ?? 0) + 1, ts: Date.now() },
    prevHorse: nextPrev,
    armed: nextArmed,
    seq: (race.seq ?? 0) + 1,
  };

  // 베팅 마감: 붉은 선(RED_LINE) 이상 말이 누적 3마리
  if (!race.bettingLocked) {
    const positions = { ...race.horses, [horseId]: { position: nextPos } };
    const crossed = HORSE_IDS.filter((h) => (positions[h]?.position ?? 0) >= RED_LINE).length;
    if (crossed >= 3) updates.bettingLocked = true;
  }

  await update(roomRef(code, 'race'), updates);

  // 스네이크 아이즈 / 박스카 VIP 효과
  if ((d1 === 1 && d2 === 1) || (d1 === 6 && d2 === 6)) {
    await applySnakeBox(code);
  }

  // 결승선 도달 -> 즉시 종료 및 정산
  if (nextPos >= FINISH_LINE) {
    await finishRace(code, horseId);
  }
}

async function applySnakeBox(code) {
  const playersSnap = await get(roomRef(code, 'players'));
  const players = playersSnap.val() || {};
  const updates = {};
  for (const [uid, p] of Object.entries(players)) {
    const amount = (p.vipCards ? Object.values(p.vipCards) : [])
      .filter((c) => c.type === 'snakeBox')
      .reduce((s, c) => s + c.amount, 0);
    if (amount > 0) updates[`players/${uid}/money`] = (p.money ?? 0) + amount;
  }
  if (Object.keys(updates).length) await update(roomRef(code), updates);
}

/** 경주 종료: 순위 판정 + 정산 + 상태 전환 (호스트만 호출) */
async function finishRace(code, winnerId) {
  const roomSnap = await get(roomRef(code));
  const room = roomSnap.val();
  const ranks = computeRanks(room.race.horses, winnerId);

  // vipCards를 배열 형태로 정규화
  const players = {};
  for (const [uid, p] of Object.entries(room.players)) {
    players[uid] = { ...p, vipCards: p.vipCards ? Object.values(p.vipCards) : [] };
  }
  const results = settleBets(room.race.bets || {}, ranks, players);

  const round = room.meta.round;
  const updates = {
    'race/finished': { winnerId, ranks },
    [`results/${round}`]: results,
  };
  for (const [uid, r] of Object.entries(results)) {
    updates[`players/${uid}/money`] = r.newMoney;
  }
  updates['meta/status'] = round < TOTAL_ROUNDS ? 'vip' : 'finished';

  // VIP 페이즈: 각 플레이어에게 카드 2장 제시
  if (round < TOTAL_ROUNDS) {
    for (const uid of Object.keys(room.players)) {
      const [a, b] = drawTwo();
      updates[`vip/${uid}`] = { offered: [a, b], picked: null };
    }
  }
  await update(roomRef(code), updates);
}

function drawTwo() {
  const pool = [...VIP_POOL];
  const i = Math.floor(Math.random() * pool.length);
  const a = pool.splice(i, 1)[0];
  const b = pool[Math.floor(Math.random() * pool.length)];
  return [a, b];
}

/**
 * [핵심] 베팅 칸 선점 — Firebase Transaction.
 * 셀이 비어 있을 때만 커밋되므로 동시에 두 명이 놓아도 정확히 한 명만 성공한다.
 * 커밋 성공 후 자신의 토큰을 used 처리한다.
 */
export async function placeBet(code, cellId, uid, tokenId) {
  // 1) 마감 여부 확인
  const lockSnap = await get(roomRef(code, 'race/bettingLocked'));
  if (lockSnap.val()) throw new Error('더 이상 베팅할 수 없습니다!');

  // 2) 토큰 정보 확인
  const isBonus = tokenId.startsWith('bt');
  const tokenPath = isBonus ? `players/${uid}/bonusTokens/${tokenId}` : `players/${uid}/tokens/${tokenId}`;
  const tokenSnap = await get(roomRef(code, tokenPath));
  const token = tokenSnap.val();
  if (!token || token.used) throw new Error('사용할 수 없는 토큰입니다.');

  // 3) 셀 선점 트랜잭션: null일 때만 기록
  const cellRef = roomRef(code, `race/bets/${cellKey(cellId)}`);
  const result = await runTransaction(cellRef, (cur) => {
    if (cur !== null) return; // undefined 반환 -> 트랜잭션 중단 (선점 실패)
    return {
      uid,
      tokenId,
      value: token.value,
      tokenPenalty: token.penalty ?? 0,
      negate: !!token.negate,
      cellId, // 원본 셀 ID 보존
      ts: Date.now(),
    };
  });
  if (!result.committed) throw new Error('다른 플레이어가 먼저 베팅한 칸입니다.');

  // 4) 토큰 소모 처리 (본인만 쓰는 경로이므로 단순 update)
  await update(roomRef(code, tokenPath), { used: true });
}

/** VIP 카드 선택 */
export async function pickVip(code, uid, card) {
  await update(roomRef(code, `vip/${uid}`), { picked: card.id });
  // 카드 효과를 플레이어에 반영
  const pRef = roomRef(code, `players/${uid}`);
  const snap = await get(pRef);
  const p = snap.val();
  const vipCards = p.vipCards ? Object.values(p.vipCards) : [];
  vipCards.push(card);
  const updates = { vipCards };
  if (card.type === 'bonusToken') {
    updates[`bonusTokens/${card.id}`] = {
      value: card.value, penalty: card.penalty, negate: card.negate, used: false,
    };
  }
  await update(pRef, updates);
}

/** 모든 플레이어가 VIP를 고르면 호스트가 다음 라운드 시작 */
export async function nextRound(code) {
  const roomSnap = await get(roomRef(code));
  const room = roomSnap.val();
  const round = room.meta.round + 1;

  const updates = {
    'meta/round': round,
    'meta/status': 'racing',
    race: {
      horses: freshHorses(),
      bettingLocked: false,
      prevHorse: null,
      armed: false,
      seq: 0,
    },
    vip: null,
  };
  const playerCount = Object.keys(room.players).length;
  for (const [uid, p] of Object.entries(room.players)) {
    updates[`players/${uid}/tokens`] = freshTokens(playerCount);
    // 보너스 토큰 재사용 가능하게 리셋
    if (p.bonusTokens) {
      for (const btId of Object.keys(p.bonusTokens)) {
        updates[`players/${uid}/bonusTokens/${btId}/used`] = false;
      }
    }
    // VIP: 무료 제공 칩 - 라운드 시작 시 지급
    const chips = (p.vipCards ? Object.values(p.vipCards) : [])
      .filter((c) => c.type === 'freeChips')
      .reduce((s, c) => s + c.amount, 0);
    if (chips > 0) updates[`players/${uid}/money`] = (p.money ?? 0) + chips;
  }
  await update(roomRef(code), updates);
}

/** 방 전체 구독 */
export function subscribeRoom(code, cb) {
  return onValue(roomRef(code), (snap) => cb(snap.val()));
}

export async function leaveRoom(code, uid) {
  await remove(roomRef(code, `players/${uid}`));
}

/** 방장이 하우스 주사위 굴림 간격(ms)을 조절 */
export async function setRollMs(code, ms) {
  await update(roomRef(code, 'meta'), { rollMs: ms });
}

const CHAT_MAX_LEN = 300;
const CHAT_HISTORY_LIMIT = 200;

/** 채팅 메시지 목록 구독 (최근 N개) */
export function subscribeChat(code, cb, limit = CHAT_HISTORY_LIMIT) {
  const q = query(roomRef(code, 'chat'), limitToLast(limit));
  return onValue(q, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    cb(list);
  });
}

/** 채팅 메시지 전송 */
export async function sendChatMessage(code, uid, name, text) {
  const trimmed = (text ?? '').trim().slice(0, CHAT_MAX_LEN);
  if (!trimmed) return;
  await push(roomRef(code, 'chat'), {
    uid,
    name: (name ?? '플레이어').slice(0, 40),
    text: trimmed,
    ts: Date.now(),
  });
}
