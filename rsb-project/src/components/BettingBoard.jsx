import React, { useState } from 'react';
import { HORSE_IDS, HORSES, BOARD, COLOR_BETS } from '../constants.js';
import { placeBet, cellKey } from '../hooks/roomActions.js';

const COLOR_HEX = { blue: '#2E86C1', orange: '#E67E22', red: '#C0392B', gray: '#5D6D7E' };

export default function BettingBoard({ roomCode, uid, me, players, race, disabled }) {
  const [selectedToken, setSelectedToken] = useState(null);
  const bets = race?.bets || {};

  const myTokens = Object.entries(me?.tokens || {}).map(([id, t]) => ({ id, ...t }));
  const myBonusTokens = Object.entries(me?.bonusTokens || {}).map(([id, t]) => ({ id, ...t }));

  const handleCell = async (cellId) => {
    if (disabled) return;
    if (!selectedToken) { alert('먼저 아래에서 베팅 토큰을 선택하세요.'); return; }
    try {
      await placeBet(roomCode, cellId, uid, selectedToken);
      setSelectedToken(null);
    } catch (e) {
      alert(e.message);
    }
  };

  const Cell = ({ cellId, m, p }) => {
    const bet = bets[cellKey(cellId)];
    const owner = bet ? players[bet.uid] : null;
    return (
      <button
        className={'cell' + (bet ? ' taken' : '') + (disabled ? ' locked' : '')}
        onClick={() => !bet && handleCell(cellId)}
        disabled={!!bet || disabled}
        title={bet ? `${owner?.name}의 ${bet.value}번 토큰` : `배당 ${m}배 / 실패 시 -$${p}`}
      >
        <span className="mult">{m}x</span>
        {p > 0 && <span className="penalty">-{p}</span>}
        {bet && (
          <span className="placed-token" style={{ background: owner?.color || '#333' }}>
            {bet.value}
          </span>
        )}
      </button>
    );
  };

  return (
    <section className="betting-area">
      <div className="board-scroll">
        <table className="betting-board">
          <thead>
            <tr>
              <th className="horse-col">말</th>
              <th colSpan={2}>SHOW <small>1~3위</small></th>
              <th colSpan={2}>PLACE <small>1~2위</small></th>
              <th colSpan={3}>WIN <small>1위</small></th>
            </tr>
          </thead>
          <tbody>
            {HORSE_IDS.map((h) => (
              <tr key={h}>
                <td className="horse-col">
                  <span className="horse-chip" style={{ background: COLOR_HEX[HORSES[h].color] }}>{HORSES[h].label}</span>
                </td>
                {BOARD[h].show.map((c, i) => (
                  <td key={'s' + i}><Cell cellId={`show:${h}:${i}`} m={c.m} p={c.p} /></td>
                ))}
                {BOARD[h].place.map((c, i) => (
                  <td key={'p' + i}><Cell cellId={`place:${h}:${i}`} m={c.m} p={c.p} /></td>
                ))}
                {BOARD[h].win.map((c, i) => (
                  <td key={'w' + i}><Cell cellId={`win:${h}:${i}`} m={c.m} p={c.p} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="color-bets">
          {Object.entries(COLOR_BETS).map(([key, cb]) => (
            <div className="color-bet" key={key}>
              <span className="cb-label">{cb.label} {cb.m}x</span>
              <Cell cellId={`color:${key}`} m={cb.m} p={cb.p} />
            </div>
          ))}
        </div>
      </div>

      <div className="token-tray">
        <span className="tray-label">내 베팅 토큰</span>
        {myTokens.map((t) => (
          <button
            key={t.id}
            className={'token' + (t.used ? ' used' : '') + (selectedToken === t.id ? ' selected' : '')}
            style={{ background: me?.color }}
            disabled={t.used || disabled}
            onClick={() => setSelectedToken(selectedToken === t.id ? null : t.id)}
          >
            {t.value}
          </button>
        ))}
        {myBonusTokens.map((t) => (
          <button
            key={t.id}
            className={'token bonus' + (t.used ? ' used' : '') + (selectedToken === t.id ? ' selected' : '')}
            disabled={t.used || disabled}
            onClick={() => setSelectedToken(selectedToken === t.id ? null : t.id)}
            title={t.negate ? '실패해도 패널티 없음' : `실패 시 추가 -$${t.penalty}`}
          >
            {t.value}{t.negate && '⊘'}
          </button>
        ))}
        {selectedToken && !disabled && <span className="tray-hint">놓을 칸을 클릭하세요</span>}
      </div>
    </section>
  );
}
