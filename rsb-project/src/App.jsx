import React, { useEffect, useRef, useState } from 'react';
import { ensureAnonAuth } from './firebase.js';
import { subscribeRoom, houseRoll } from './hooks/roomActions.js';
import Lobby from './components/Lobby.jsx';
import GameRoom from './components/GameRoom.jsx';

export default function App() {
  const [uid, setUid] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [room, setRoom] = useState(null);
  const rollTimer = useRef(null);

  useEffect(() => {
    ensureAnonAuth().then(setUid).catch((e) => alert('로그인 실패: ' + e.message));
  }, []);

  // 방 구독
  useEffect(() => {
    if (!roomCode) return;
    const unsub = subscribeRoom(roomCode, setRoom);
    return () => unsub();
  }, [roomCode]);

  // [하우스 루프] 호스트 클라이언트만 주사위를 자동으로 굴린다.
  // 경주 상태의 단일 작성자를 호스트로 고정해 동기화 충돌을 없앤다.
  const isHost = room?.meta?.hostUid === uid;
  const status = room?.meta?.status;
  useEffect(() => {
    clearInterval(rollTimer.current);
    if (isHost && status === 'racing' && roomCode) {
      const ms = room?.meta?.rollMs ?? 2500;
      rollTimer.current = setInterval(() => {
        houseRoll(roomCode).catch(console.error);
      }, ms);
    }
    return () => clearInterval(rollTimer.current);
  }, [isHost, status, roomCode, room?.meta?.rollMs]);

  if (!uid) return <div className="center-screen">접속 중…</div>;

  if (!roomCode || !room) {
    return <Lobby uid={uid} onEnterRoom={setRoomCode} />;
  }
  return (
    <GameRoom
      uid={uid}
      roomCode={roomCode}
      room={room}
      isHost={isHost}
      onLeave={() => { setRoomCode(null); setRoom(null); }}
    />
  );
}
