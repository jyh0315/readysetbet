import React, { useState } from 'react';
import { createRoom, joinRoom } from '../hooks/roomActions.js';
import { PLAYER_COLORS } from '../constants.js';

export default function Lobby({ uid, onEnterRoom }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PLAYER_COLORS[0]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const guard = () => {
    if (!name.trim()) { alert('이름을 입력하세요.'); return false; }
    return true;
  };

  const handleCreate = async () => {
    if (!guard()) return;
    setBusy(true);
    try {
      const newCode = await createRoom(uid, name.trim(), color);
      onEnterRoom(newCode);
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const handleJoin = async () => {
    if (!guard()) return;
    if (!code.trim()) { alert('방 코드를 입력하세요.'); return; }
    setBusy(true);
    try {
      const c = code.trim().toUpperCase();
      await joinRoom(c, uid, name.trim(), color);
      onEnterRoom(c);
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="lobby">
      <header className="lobby-hero">
        <div className="hero-horses" aria-hidden>🐎🐎🐎</div>
        <h1>레디 셋 벳 <span>온라인</span></h1>
        <p>실시간 경마 베팅 — 주사위가 구르는 동안, 먼저 놓는 사람이 임자입니다.</p>
      </header>

      <section className="lobby-card">
        <label>
          플레이어 이름
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="예: 동훈" />
        </label>

        <div className="color-picker">
          <span>토큰 색상</span>
          <div className="swatches">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                className={'swatch' + (color === c ? ' selected' : '')}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="lobby-actions">
          <button className="btn primary" disabled={busy} onClick={handleCreate}>
            새 경마장 열기
          </button>
          <div className="join-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="방 코드 (예: KX7Q2)"
              maxLength={5}
            />
            <button className="btn" disabled={busy} onClick={handleJoin}>입장</button>
          </div>
        </div>
      </section>
    </div>
  );
}
