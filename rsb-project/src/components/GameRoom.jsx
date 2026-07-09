import React from 'react';
import RaceTrack from './RaceTrack.jsx';
import BettingBoard from './BettingBoard.jsx';
import DicePanel from './DicePanel.jsx';
import Scoreboard from './Scoreboard.jsx';
import VipPicker from './VipPicker.jsx';
import ResultsModal from './ResultsModal.jsx';
import ChatPanel from './ChatPanel.jsx';
import { startRace, nextRound, leaveRoom, setRollMs } from '../hooks/roomActions.js';
import { TOTAL_ROUNDS } from '../constants.js';

export default function GameRoom({ uid, roomCode, room, isHost, onLeave }) {
  const { meta, players = {}, race, vip, results } = room;
  const status = meta.status;
  const me = players[uid];

  const allPicked = vip && Object.values(vip).every((v) => v.picked);

  const handleLeave = async () => {
    if (status === 'lobby') await leaveRoom(roomCode, uid).catch(() => {});
    onLeave();
  };

  return (
    <div className="game-room">
      <header className="room-header">
        <div>
          <h2>레디 셋 벳 <span className="room-code">방 {roomCode}</span></h2>
          <span className="round-chip">라운드 {meta.round} / {TOTAL_ROUNDS}</span>
        </div>
        <div className="header-right">
          {status === 'racing' && race?.bettingLocked && (
            <span className="lock-banner" role="alert">🔒 더 이상 베팅할 수 없습니다!</span>
          )}
          <button className="btn ghost" onClick={handleLeave}>나가기</button>
        </div>
      </header>

      <Scoreboard players={players} uid={uid} hostUid={meta.hostUid} />

      {status === 'lobby' && (
        <section className="waiting">
          <p>플레이어 {Object.keys(players).length}명 대기 중. 친구에게 방 코드 <b>{roomCode}</b>를 알려주세요.</p>
          {isHost ? (
            <button className="btn primary big" onClick={() => startRace(roomCode)}>
              출발합니다! 🏇
            </button>
          ) : (
            <p className="muted">하우스(방장)가 경주를 시작하길 기다리는 중…</p>
          )}
        </section>
      )}

      {(status === 'racing' || status === 'vip' || status === 'finished') && race && (
        <>
          <DicePanel
            lastRoll={race.lastRoll}
            isHost={isHost}
            rollMs={meta.rollMs}
            onChangeSpeed={status === 'racing' ? (ms) => setRollMs(roomCode, ms) : null}
          />
          <RaceTrack horses={race.horses} finished={race.finished} />
          <BettingBoard
            roomCode={roomCode}
            uid={uid}
            me={me}
            players={players}
            race={race}
            disabled={status !== 'racing' || !!race.bettingLocked}
          />
        </>
      )}

      {status === 'vip' && (
        <VipPicker
          roomCode={roomCode}
          uid={uid}
          vip={vip}
          players={players}
          results={results?.[meta.round]}
          ranks={race?.finished?.ranks}
          isHost={isHost}
          allPicked={allPicked}
          onNextRound={() => nextRound(roomCode)}
        />
      )}

      {status === 'finished' && (
        <ResultsModal players={players} results={results} ranks={race?.finished?.ranks} />
      )}

      <ChatPanel roomCode={roomCode} uid={uid} me={me} players={players} />
    </div>
  );
}
