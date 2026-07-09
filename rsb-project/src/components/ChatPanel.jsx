import React, { useEffect, useRef, useState } from 'react';
import { subscribeChat, sendChatMessage } from '../hooks/roomActions.js';

export default function ChatPanel({ roomCode, uid, me, players = {} }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const seenCountRef = useRef(0);

  useEffect(() => {
    if (!roomCode) return;
    const unsub = subscribeChat(roomCode, setMessages);
    return () => unsub();
  }, [roomCode]);

  useEffect(() => {
    if (open) {
      seenCountRef.current = messages.length;
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (messages.length > seenCountRef.current) {
      setUnread(messages.length - seenCountRef.current);
    }
  }, [messages, open]);

  const handleSend = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    sendChatMessage(roomCode, uid, me?.name, t).catch((err) => alert('전송 실패: ' + err.message));
    setText('');
  };

  return (
    <div className={'chat-widget' + (open ? ' open' : '')}>
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>💬 채팅</span>
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="채팅 닫기">✕</button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="muted chat-empty">아직 메시지가 없습니다. 첫 메시지를 남겨보세요!</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={'chat-msg' + (m.uid === uid ? ' me' : '')}>
                <span
                  className="chat-msg-name"
                  style={{ color: players[m.uid]?.color ?? 'var(--gold)' }}
                >
                  {m.name}
                </span>
                <span className="chat-msg-text">{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              placeholder="메시지를 입력하세요…"
              aria-label="채팅 메시지 입력"
            />
            <button className="btn primary" type="submit" disabled={!text.trim()}>보내기</button>
          </form>
        </div>
      )}
      {!open && (
        <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-label="채팅 열기">
          💬
          {unread > 0 && <span className="chat-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}
    </div>
  );
}
