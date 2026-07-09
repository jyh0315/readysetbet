import React from 'react';

export default function Scoreboard({ players, uid, hostUid }) {
  const list = Object.entries(players).sort((a, b) => (b[1].money ?? 0) - (a[1].money ?? 0));
  return (
    <div className="scoreboard">
      {list.map(([id, p]) => (
        <div key={id} className={'player-chip' + (id === uid ? ' me' : '')}>
          <i className="pc-dot" style={{ background: p.color }} />
          <span className="pc-name">
            {p.name}{id === hostUid && ' 🏠'}{id === uid && ' (나)'}
          </span>
          <b className="pc-money">${p.money ?? 0}</b>
        </div>
      ))}
    </div>
  );
}
