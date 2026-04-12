import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GameScene } from '../components/3d/GameScene';
import { HUD } from '../components/ui/HUD';
import { SpinSelector } from '../components/ui/SpinSelector';
import { useGameStore } from '../store/gameStore';
import { SpinType } from '../engine/types';
import {
  createRoom,
  joinRoom,
  onMessage,
  onStatus,
  disconnect,
} from '../multiplayer/peer';

type ConnectionState = 'idle' | 'creating' | 'waiting' | 'joining' | 'connected' | 'error';

const SPIN_KEYS: Record<string, SpinType> = {
  '1': 'topspin',
  '2': 'backspin',
  '3': 'sidespin-left',
  '4': 'sidespin-right',
  '5': 'flat',
};

export function Multiplayer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [, setIsHost] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const setSelectedSpin = useGameStore((s) => s.setSelectedSpin);
  const setOpponentPaddleX = useGameStore((s) => s.setOpponentPaddleX);

  useEffect(() => {
    const room = searchParams.get('room');
    if (room) {
      setJoinId(room);
      handleJoin(room);
    }
    return () => {
      disconnect();
      resetGame();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (SPIN_KEYS[e.key]) {
        setSelectedSpin(SPIN_KEYS[e.key]);
      }
      if (e.key === 'Escape') {
        disconnect();
        resetGame();
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = useCallback(async () => {
    setConnState('creating');
    try {
      const id = await createRoom();
      setRoomId(id);
      setIsHost(true);
      setConnState('waiting');
      const url = `${window.location.origin}/multiplayer?room=${id}`;
      setShareUrl(url);

      onStatus((status) => {
        if (status === 'connected') {
          setConnState('connected');
          startGame('multiplayer');
        }
        if (status === 'disconnected') setConnState('idle');
      });

      onMessage((msg) => {
        if (msg.type === 'paddle-move') {
          setOpponentPaddleX(msg.x);
        }
      });
    } catch {
      setConnState('error');
    }
  }, [startGame, setOpponentPaddleX]);

  const handleJoin = useCallback(async (id?: string) => {
    const targetId = id || joinId;
    if (!targetId.trim()) return;
    setConnState('joining');
    try {
      await joinRoom(targetId.trim());
      setConnState('connected');
      setIsHost(false);
      startGame('multiplayer');

      onStatus((status) => {
        if (status === 'disconnected') setConnState('idle');
      });

      onMessage((msg) => {
        if (msg.type === 'paddle-move') {
          setOpponentPaddleX(msg.x);
        }
      });
    } catch {
      setConnState('error');
    }
  }, [joinId, startGame, setOpponentPaddleX]);

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  if (connState === 'connected') {
    return (
      <div className="w-full h-full relative">
        <GameScene />
        <HUD />
        <SpinSelector />
        <button
          onClick={() => {
            disconnect();
            resetGame();
            navigate('/');
          }}
          className="fixed top-3 left-3 z-30 px-3 py-1 bg-black/50 backdrop-blur rounded-lg text-sm text-gray-400 hover:text-white transition-colors cursor-pointer pointer-events-auto"
        >
          ← Leave
        </button>
        <div className="fixed top-3 right-3 z-30 px-3 py-1 bg-green-500/20 backdrop-blur rounded-lg text-sm text-green-400 pointer-events-none">
          🟢 Connected
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a1628] to-[#0d2137]">
      <div className="max-w-md w-full px-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          ← Back to Menu
        </button>

        <h2 className="text-2xl font-black text-white mb-6">👥 Multiplayer</h2>

        {connState === 'idle' || connState === 'error' ? (
          <div className="space-y-4">
            {connState === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                Connection failed. Check the room ID and try again.
              </div>
            )}

            {/* Create Room */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2">Create a Room</h3>
              <p className="text-sm text-gray-400 mb-4">
                Start a room and share the link with your friend.
              </p>
              <button
                onClick={handleCreate}
                className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Create Room
              </button>
            </div>

            {/* Join Room */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2">Join a Room</h3>
              <p className="text-sm text-gray-400 mb-3">
                Enter the room ID your friend shared.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="spinpong-abc123"
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => handleJoin()}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        ) : connState === 'creating' || connState === 'joining' ? (
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-white font-bold">Connecting...</p>
          </div>
        ) : connState === 'waiting' ? (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-center">
            <div className="text-4xl mb-4">📡</div>
            <p className="text-white font-bold mb-2">Waiting for opponent...</p>
            <p className="text-sm text-gray-400 mb-4">Share this link with your friend:</p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-xs font-mono"
              />
              <button
                onClick={copyShareUrl}
                className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition-colors cursor-pointer"
              >
                Copy
              </button>
            </div>

            <p className="text-xs text-gray-500">Room ID: {roomId}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
