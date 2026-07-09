import React from 'react';
import { HORSES } from '../constants.js';

const PIP = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const SPEED_PRESETS = [
  { label: '🐢 느림', ms: 4000 },
  { label: '🚶 보통', ms: 2500 },
  { label: '🏃 빠름', ms: 1500 },
  { label: '⚡ 매우 빠름', ms: 800 },
];

export default function DicePanel({ lastRoll, isHost, rollMs, onChangeSpeed }) {
  const { d1, d2, sum, horseId, bonus, seq } = lastRoll ?? {};
  const special = lastRoll && (d1 === 1 && d2 === 1 ? '스네이크 아이즈!' : d1 === 6 && d2 === 6 ? '박스카!' : null);

  return (
    <>
      {isHost && onChangeSpeed && (
        <div className="speed-control">
          <span className="speed-label">🎲 주사위 속도 (방장 전용)</span>
          <div className="speed-buttons">
            {SPEED_PRESETS.map((s) => (
              <button
                key={s.ms}
                type="button"
                className={'btn speed-btn' + (rollMs === s.ms ? ' active' : '')}
                onClick={() => onChangeSpeed(s.ms)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!lastRoll ? (
        <div className="dice-panel muted">하우스가 주사위를 준비하고 있습니다…</div>
      ) : (
        <div className="dice-panel" key={seq}>
          <span className="die">{PIP[d1]}</span>
          <span className="die">{PIP[d2]}</span>
          <span className="roll-text">
            합 <b>{sum}</b> → <b>{HORSES[horseId]?.label ?? horseId}번마</b> 전진
            {bonus > 0 && <em className="bonus-flash"> 연속! 보너스 +{bonus}칸</em>}
            {special && <em className="special-flash"> {special}</em>}
          </span>
        </div>
      )}
    </>
  );
}
