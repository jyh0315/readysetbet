import React from 'react';
import { pickVip } from '../hooks/roomActions.js';

export default function VipPicker({ roomCode, uid, vip, players, results, ranks, isHost, allPicked, onNextRound }) {
  const mine = vip?.[uid];
  const podium = ranks
    ? Object.entries(ranks).filter(([, r]) => r <= 3).sort((a, b) => a[1] - b[1])
    : [];

  return (
    <div className="modal-backdrop">
      <div className="modal vip-modal">
        <h3>라운드 정산 & VIP 카드</h3>

        {podium.length > 0 && (
          <p className="podium">
            {podium.map(([h, r]) => <span key={h} className="podium-item">{r}위 {h}번마</span>)}
          </p>
        )}

        {results && (
          <table className="result-table">
            <thead><tr><th>플레이어</th><th>획득</th><th>손실</th><th>증감</th><th>보유</th></tr></thead>
            <tbody>
              {Object.entries(results).map(([id, r]) => (
                <tr key={id} className={id === uid ? 'me' : ''}>
                  <td>{players[id]?.name}</td>
                  <td>+${r.gain}</td>
                  <td>-${r.loss}</td>
                  <td className={r.delta >= 0 ? 'pos' : 'neg'}>{r.delta >= 0 ? '+' : ''}{r.delta}</td>
                  <td><b>${r.newMoney}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {mine && !mine.picked && (
          <>
            <p>VIP 카드 2장 중 1장을 선택해 남은 게임 동안 지속 능력을 얻으세요.</p>
            <div className="vip-cards">
              {mine.offered.map((card) => (
                <button key={card.id} className="vip-card" onClick={() => pickVip(roomCode, uid, card)}>
                  <span className="vip-title">VIP</span>
                  <b>{card.name}</b>
                  <small>
                    {card.type === 'bonusToken' && '추가 베팅 토큰을 얻습니다. 매 라운드 재사용.'}
                    {card.type === 'freeChips' && '매 라운드 시작 시 자동 지급됩니다.'}
                    {card.type === 'shield' && '매 라운드 실패 패널티 합계를 경감합니다.'}
                    {card.type === 'snakeBox' && '1-1 또는 6-6이 나올 때마다 지급됩니다.'}
                  </small>
                </button>
              ))}
            </div>
          </>
        )}

        {mine?.picked && !allPicked && <p className="muted">다른 플레이어의 선택을 기다리는 중…</p>}

        {allPicked && (
          isHost
            ? <button className="btn primary big" onClick={onNextRound}>다음 라운드 시작 🏇</button>
            : <p className="muted">하우스가 다음 라운드를 시작하길 기다리는 중…</p>
        )}
      </div>
    </div>
  );
}
