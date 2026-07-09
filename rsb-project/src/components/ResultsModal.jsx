import React from 'react';

export default function ResultsModal({ players, results, ranks }) {
  const standings = Object.entries(players)
    .sort((a, b) => (b[1].money ?? 0) - (a[1].money ?? 0));
  const top = standings[0]?.[1]?.money ?? 0;
  const winners = standings.filter(([, p]) => (p.money ?? 0) === top);

  return (
    <div className="modal-backdrop">
      <div className="modal final-modal">
        <h3>🏆 최종 결과</h3>
        <p className="final-winner">
          {winners.map(([, p]) => p.name).join(', ')} 우승! (${top})
        </p>
        <ol className="final-list">
          {standings.map(([id, p]) => (
            <li key={id}>
              <i className="pc-dot" style={{ background: p.color }} /> {p.name} — <b>${p.money ?? 0}</b>
            </li>
          ))}
        </ol>
        <p className="muted">새 게임을 하려면 새로고침 후 방을 다시 만드세요.</p>
      </div>
    </div>
  );
}
