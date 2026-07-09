import React from 'react';
import { HORSE_IDS, HORSES, TRACK_LENGTH, RED_LINE, FINISH_LINE } from '../constants.js';

const COLOR_HEX = { blue: '#2E86C1', orange: '#E67E22', red: '#C0392B', gray: '#5D6D7E' };

export default function RaceTrack({ horses = {}, finished }) {
  return (
    <section className="race-track" aria-label="경주로">
      {HORSE_IDS.map((id) => {
        const pos = horses[id]?.position ?? 0;
        const pct = (Math.min(pos, FINISH_LINE) / FINISH_LINE) * 100;
        const rank = finished?.ranks?.[id];
        return (
          <div className="lane" key={id}>
            <div className="lane-label" style={{ background: COLOR_HEX[HORSES[id].color] }}>
              {HORSES[id].label}
              {HORSES[id].bonus > 0 && <em className="bonus-tag">+{HORSES[id].bonus}</em>}
            </div>
            <div className="lane-body">
              {/* 칸 눈금 */}
              {Array.from({ length: TRACK_LENGTH }, (_, i) => (
                <span
                  key={i}
                  className={
                    'tick' +
                    (i === RED_LINE ? ' red-line' : '') +
                    (i === FINISH_LINE ? ' finish-line' : '')
                  }
                  style={{ left: `${(i / FINISH_LINE) * 100}%` }}
                />
              ))}
              {/* 말 미플 — left transition으로 부드럽게 전진 */}
              <div
                className={'horse' + (rank === 1 ? ' winner' : '')}
                style={{ left: `calc(${pct}% - 14px)`, background: COLOR_HEX[HORSES[id].color] }}
              >
                🐎
                {rank && <span className="rank-badge">{rank}위</span>}
              </div>
            </div>
          </div>
        );
      })}
      <div className="track-legend">
        <span><i className="dot red" /> 붉은 선: 3마리 통과 시 베팅 마감</span>
        <span><i className="dot gold" /> 결승선: 15번째 칸</span>
      </div>
    </section>
  );
}
