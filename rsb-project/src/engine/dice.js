import { sumToHorse, HORSES } from '../constants.js';

export function rollDice() {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return { d1, d2, sum: d1 + d2 };
}

/**
 * 연속 굴림 보너스 판정.
 * 규칙: 동일한 경주마(2/3, 11/12는 두 숫자 모두 포함)가 연속 두 번 나오면 보너스.
 * 세 번째 연속 굴림에는 보너스가 없고, 세 번째+네 번째가 새로운 쌍을 이룬다.
 *
 * @param {string|null} prevHorse 직전 굴림의 경주마
 * @param {boolean} armed 직전 굴림이 '새 쌍의 첫 굴림' 상태인지
 * @param {number} sum 이번 굴림 합
 * @returns {{horseId, bonus, nextPrev, nextArmed}}
 */
export function resolveRoll(prevHorse, armed, sum) {
  const horseId = sumToHorse(sum);
  if (horseId === prevHorse && armed) {
    // 두 번째 연속 굴림 -> 보너스 발동, 다음 동일 굴림(세 번째)은 새 쌍의 시작
    return { horseId, bonus: HORSES[horseId].bonus, nextPrev: horseId, nextArmed: false };
  }
  // 새 쌍의 첫 굴림 (또는 세 번째 연속 굴림)
  return { horseId, bonus: 0, nextPrev: horseId, nextArmed: true };
}
