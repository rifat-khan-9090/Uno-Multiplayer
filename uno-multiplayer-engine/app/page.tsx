'use client';
import { useState, useEffect } from 'react';
import { UnoGame, Card, Color, Player } from '@/lib/uno-engine';
import { io, Socket } from 'socket.io-client';

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [game, setGame] = useState<UnoGame | null>(null);
  const [view, setView] = useState<'entry' | 'lobby' | 'game'>('entry');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<{id: string, name: string, isBot?: boolean}[]>([]);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);
  const [myId, setMyId] = useState('');

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setMyId(newSocket.id!);
    });

    newSocket.on('player_joined', (pList) => {
      setPlayers(pList);
    });

    newSocket.on('game_started', (initialState) => {
      Object.setPrototypeOf(initialState, UnoGame.prototype);
      setGame(initialState);
      setView('game');
    });

    newSocket.on('game_state_update', (newState) => {
      Object.setPrototypeOf(newState, UnoGame.prototype);
      setGame(newState);
    });

    newSocket.on('error_message', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    newSocket.on('game_message', (msg) => {
      setGame(prev => {
        if (!prev) return prev;
        const newG = { ...prev };
        Object.setPrototypeOf(newG, UnoGame.prototype);
        newG.messages = [...newG.messages, msg];
        return newG as UnoGame;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleCreateRoom = () => {
    if (!playerName) { setError('Enter your name'); return; }
    socket?.emit('create_room', playerName, (res: any) => {
      setRoomCode(res.roomCode);
      setPlayers(res.players);
      setView('lobby');
      setError('');
    });
  };

  const handleJoinRoom = () => {
    if (!playerName || !roomCodeInput) { setError('Enter name and room code'); return; }
    socket?.emit('join_room', { roomCode: roomCodeInput, playerName }, (res: any) => {
      if (res.error) {
        setError(res.error);
        return;
      }
      setRoomCode(roomCodeInput);
      setPlayers(res.players);
      setView('lobby');
      setError('');
    });
  };

  const handleAddBot = () => {
    socket?.emit('add_bot', roomCode, (res: any) => {
      if (res.error) {
        setError(res.error);
      } else if (res.players) {
        setPlayers(res.players);
      }
    });
  };

  const handleRemoveBot = (botId: string) => {
    socket?.emit('remove_bot', { roomCode, botId }, (res: any) => {
      if (res.players) {
        setPlayers(res.players);
      }
    });
  };

  const handleStartGame = () => {
    if (players.length < 2) {
      setError('At least 2 players (or 1 player + 1 bot) required to start');
      return;
    }
    socket?.emit('start_game', roomCode);
  };

  const handlePlayCard = (cardId: string, chosenWildColor?: Color) => {
    socket?.emit('play_card', { roomCode, cardId, chosenWildColor });
  };

  const onCardClick = (card: Card) => {
    if (card.color === 'Wild') {
      setPendingWildCardId(card.id);
    } else {
      handlePlayCard(card.id);
    }
  };

  const selectWildColorAndPlay = (color: Color) => {
    if (pendingWildCardId) {
      handlePlayCard(pendingWildCardId, color);
      setPendingWildCardId(null);
    }
  };

  const handleDrawCard = () => {
    socket?.emit('draw_card', roomCode);
  };

  const handleSayUno = () => {
    socket?.emit('say_uno', roomCode);
  };

  if (view === 'entry') {
    return (
      <div className="w-full h-screen bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-8 font-sans">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center font-black text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] text-4xl italic mb-4">U</div>
          <h1 className="text-4xl font-bold tracking-tight text-white">UNO MULTIPLAYER</h1>
          <p className="text-slate-400 mt-2 font-mono text-sm">MULTIPLAYER ARENA</p>
        </div>
        
        <div className="max-w-md w-full space-y-6 bg-slate-900/80 p-8 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
          {error && <p className="text-red-400 text-xs font-bold text-center bg-red-900/30 p-2 rounded">{error}</p>}
          
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2 font-bold">Your Name</label>
            <input 
              type="text" 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your alias"
            />
          </div>

          <div className="pt-4 pb-4 border-b border-slate-800">
            <button 
              onClick={handleCreateRoom}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              CREATE NEW ROOM
            </button>
          </div>

          <div className="pt-2">
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2 font-bold">Or Join Room</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm uppercase"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="6-LETTER CODE"
                maxLength={6}
              />
              <button 
                onClick={handleJoinRoom}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-[0_0_20px_rgba(5,150,105,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'lobby') {
    const isHost = players[0]?.id === myId;
    return (
      <div className="w-full h-screen bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-8 font-sans">
        <div className="max-w-md w-full bg-slate-900/80 p-8 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-2">Lobby</h2>
          <div className="text-sm font-mono text-slate-400 mb-6 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            ROOM CODE: <span className="text-white font-bold text-lg">{roomCode}</span>
          </div>

          {error && <p className="text-red-400 text-xs font-bold text-center bg-red-900/30 p-2 rounded mb-4 w-full">{error}</p>}

          <div className="w-full mb-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold">Players Joined ({players.length}/10)</h3>
              {isHost && players.length < 10 && (
                <button
                  onClick={handleAddBot}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-md shadow-md transition-all flex items-center gap-1"
                >
                  🤖 + ADD BOT
                </button>
              )}
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {players.map((p, idx) => (
                <li key={p.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {p.isBot ? '🤖' : idx + 1}
                    </div>
                    <span className="font-medium text-slate-200">
                      {p.name} {p.id === myId && "(You)"}
                      {idx === 0 && <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded uppercase tracking-widest">Host</span>}
                      {p.isBot && <span className="ml-2 text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded uppercase tracking-widest">BOT</span>}
                    </span>
                  </div>
                  {isHost && p.isBot && (
                    <button
                      onClick={() => handleRemoveBot(p.id)}
                      className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-950/40 hover:bg-red-900/50 rounded border border-red-800/50"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <button 
              onClick={handleStartGame}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              START GAME ({players.length} PLAYERS)
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-3 bg-slate-950 py-3 rounded-lg border border-slate-800 text-sm text-slate-400 font-mono">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              WAITING FOR HOST...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!game) return null;

  const currentPlayerIndex = game.players.findIndex(p => p.id === myId);
  const currentPlayer = game.players[currentPlayerIndex >= 0 ? currentPlayerIndex : 0];
  const activeTurnPlayer = game.players[game.currentPlayerIndex];
  
  // Arrange other players for the table view
  const otherPlayers = game.players.filter(p => p.id !== myId);
  const topPlayer = otherPlayers.length > 0 ? otherPlayers[Math.floor(otherPlayers.length / 2)] : null;
  const leftPlayer = otherPlayers.length > 1 ? otherPlayers[0] : null;
  const rightPlayer = otherPlayers.length > 2 ? otherPlayers[otherPlayers.length - 1] : null;
  const topCard = game.discardPile?.length > 0 ? game.discardPile[game.discardPile.length - 1] : null;

  return (
    <div className="w-full h-screen bg-[#020617] flex flex-col font-sans overflow-hidden text-slate-200">
      {/* Header / Game Info Bar */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-8 bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center font-black text-white shadow-lg italic text-lg sm:text-xl">U</div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold leading-none tracking-tight">UNO MULTIPLAYER</h1>
            <p className="text-xs text-slate-400 font-mono mt-1">ROOM: #{roomCode}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-8 bg-slate-950/50 px-4 sm:px-6 py-2 rounded-full border border-slate-800">
          <div className="flex flex-col items-center">
            <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-500">Active</span>
            <div className={`w-8 sm:w-12 h-1.5 sm:h-2 rounded-full mt-1 ${getGlowClass(game.activeColor!)}`}></div>
          </div>
          <div className="w-px h-6 bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-500">Dir</span>
            <span className={`text-[10px] sm:text-xs font-bold ${game.direction === 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {game.direction === 1 ? 'CLOCK ↻' : 'COUNTER ↺'}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => { setView('entry'); socket?.disconnect(); }} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-[10px] sm:text-xs font-semibold border border-slate-700 transition-colors">LEAVE</button>
        </div>
      </div>

      {/* Game Arena */}
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-12 overflow-hidden">
        {/* The Digital Table */}
        <div className="absolute inset-2 sm:inset-8 lg:inset-16 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 rounded-[60px] sm:rounded-[120px] shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] sm:shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] border-[6px] sm:border-[12px] border-slate-900 flex items-center justify-center overflow-hidden">
          {/* Ambient Lighting Effects */}
          <div className="absolute top-0 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-blue-500/5 blur-[80px] sm:blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-indigo-500/5 blur-[80px] sm:blur-[120px] rounded-full"></div>

          {/* Player Positions */}
          {topPlayer && (
            <div className={`absolute top-4 sm:top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 sm:gap-2 transition-all ${activeTurnPlayer?.id === topPlayer.id ? 'scale-110' : 'opacity-80'}`}>
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 bg-slate-800 flex items-center justify-center shadow-lg transition-colors ${activeTurnPlayer?.id === topPlayer.id ? 'border-amber-400 ring-4 ring-amber-500/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-slate-700'}`}>
                <span className="text-sm sm:text-xl">{topPlayer.isBot ? '🤖' : '👤'}</span>
              </div>
              <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold border ${activeTurnPlayer?.id === topPlayer.id ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-black/40 text-slate-300 border-white/5'}`}>
                {topPlayer.name} ({topPlayer.hand?.length || 0})
              </div>
            </div>
          )}

          {leftPlayer && leftPlayer.id !== topPlayer?.id && (
            <div className={`absolute left-4 lg:left-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 sm:gap-2 transition-all ${activeTurnPlayer?.id === leftPlayer.id ? 'scale-110' : 'opacity-80'}`}>
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 bg-slate-800 flex items-center justify-center shadow-lg transition-colors ${activeTurnPlayer?.id === leftPlayer.id ? 'border-amber-400 ring-4 ring-amber-500/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-slate-700'}`}>
                <span className="text-sm sm:text-xl">{leftPlayer.isBot ? '🤖' : '👤'}</span>
              </div>
              <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold border ${activeTurnPlayer?.id === leftPlayer.id ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-black/40 text-slate-300 border-white/5'}`}>
                {leftPlayer.name} ({leftPlayer.hand?.length || 0})
              </div>
            </div>
          )}

          {rightPlayer && rightPlayer.id !== topPlayer?.id && rightPlayer.id !== leftPlayer?.id && (
            <div className={`absolute right-4 lg:right-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 sm:gap-2 transition-all ${activeTurnPlayer?.id === rightPlayer.id ? 'scale-110' : 'opacity-80'}`}>
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 bg-slate-800 flex items-center justify-center shadow-lg transition-colors ${activeTurnPlayer?.id === rightPlayer.id ? 'border-amber-400 ring-4 ring-amber-500/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-slate-700'}`}>
                <span className="text-sm sm:text-xl">{rightPlayer.isBot ? '🤖' : '🦊'}</span>
              </div>
              <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold border ${activeTurnPlayer?.id === rightPlayer.id ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-black/40 text-slate-300 border-white/5'}`}>
                {rightPlayer.name} ({rightPlayer.hand?.length || 0})
              </div>
            </div>
          )}

          {/* Center Piles */}
          <div className="flex items-center gap-6 lg:gap-16 z-10 scale-90 sm:scale-100">
            {/* Draw Pile */}
            <div className="relative group cursor-pointer hover:scale-105 transition-transform" onClick={handleDrawCard}>
              <div className="absolute -top-1 -left-1 w-[60px] h-[84px] sm:w-[80px] sm:h-[112px] lg:w-[100px] lg:h-[140px] bg-slate-700 rounded-xl"></div>
              <div className="absolute -top-2 -left-2 w-[60px] h-[84px] sm:w-[80px] sm:h-[112px] lg:w-[100px] lg:h-[140px] bg-slate-600 rounded-xl"></div>
              <div className="w-[60px] h-[84px] sm:w-[80px] sm:h-[112px] lg:w-[100px] lg:h-[140px] bg-gradient-to-br from-slate-800 to-black border-2 border-slate-700 rounded-xl flex items-center justify-center shadow-2xl relative">
                 <div className="w-8 h-12 sm:w-10 sm:h-14 lg:w-12 lg:h-16 rounded-full border-4 border-slate-800 flex items-center justify-center opacity-30">
                    <span className="font-black text-sm sm:text-lg lg:text-xl italic">U</span>
                 </div>
                 <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 text-[8px] sm:text-[10px] text-slate-500 font-mono">{game.deck.length} LEFT</div>
              </div>
            </div>

            {/* Discard Pile */}
            <div className="relative">
              <div className="absolute top-1 rotate-6 w-[60px] h-[84px] sm:w-[80px] sm:h-[112px] lg:w-[100px] lg:h-[140px] bg-slate-800/80 rounded-xl border-2 border-white/5 shadow-lg"></div>
              <div className="absolute -top-2 -rotate-3 w-[60px] h-[84px] sm:w-[80px] sm:h-[112px] lg:w-[100px] lg:h-[140px] bg-slate-700/80 rounded-xl border-2 border-white/5 shadow-lg"></div>
              {topCard && (
                <TableCardView card={topCard} />
              )}
            </div>
          </div>
          
          {game.winner && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
              <div className="text-4xl sm:text-6xl text-amber-400 font-black italic drop-shadow-[0_0_30px_rgba(251,191,36,0.6)] mb-4 uppercase text-center px-4">
                {game.winner.name} WINS!
              </div>
              <button 
                onClick={() => { setView('lobby'); }}
                className="mt-6 px-6 py-3 sm:px-8 sm:py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all hover:scale-105"
              >
                RETURN TO LOBBY
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500 text-red-100 px-6 py-3 rounded-full font-bold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          {error}
        </div>
      )}

      {/* Wild Card Color Selection Modal */}
      {pendingWildCardId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl max-w-sm w-full flex flex-col items-center text-center shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Select Wild Color</h3>
            <p className="text-xs text-slate-400 mb-6">Choose the active color for the next turn</p>
            <div className="grid grid-cols-2 gap-4 w-full">
              <button onClick={() => selectWildColorAndPlay('Red')} className="h-16 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all hover:scale-105">Red</button>
              <button onClick={() => selectWildColorAndPlay('Yellow')} className="h-16 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-lg shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-all hover:scale-105">Yellow</button>
              <button onClick={() => selectWildColorAndPlay('Green')} className="h-16 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all hover:scale-105">Green</button>
              <button onClick={() => selectWildColorAndPlay('Blue')} className="h-16 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all hover:scale-105">Blue</button>
            </div>
            <button onClick={() => setPendingWildCardId(null)} className="mt-6 text-xs text-slate-500 hover:text-slate-300 font-semibold uppercase tracking-wider">Cancel</button>
          </div>
        </div>
      )}

      {/* Action Buttons Corner */}
      <div className="fixed bottom-32 sm:bottom-8 right-4 sm:right-8 flex flex-col gap-4 items-end z-30">
        <button 
          onClick={handleSayUno}
          className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-red-600 to-red-900 text-white font-black text-sm sm:text-xl shadow-2xl border-4 border-red-500/50 flex items-center justify-center active:scale-95 transition-transform hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]"
        >
          UNO!
        </button>
      </div>

      {/* Bottom: Player Hand Area */}
      <div className="h-48 sm:h-56 bg-gradient-to-t from-slate-950 to-transparent flex flex-col items-center justify-end pb-4 sm:pb-8 shrink-0 z-20">
        {/* Turn Indicator */}
        <div className="mb-4 sm:mb-6 flex flex-col items-center gap-2 sm:gap-3">
          <div className={`px-4 py-1 sm:px-6 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold border uppercase tracking-widest transition-all ${activeTurnPlayer?.id === myId ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-800/50 text-slate-400 border-slate-700/50'}`}>
            {activeTurnPlayer?.id === myId ? "YOUR TURN • SELECT A CARD" : `${activeTurnPlayer?.name}'S TURN`}
          </div>
        </div>
        
        {/* Player Cards Hand */}
        <div className="flex flex-wrap items-center justify-center -space-x-4 sm:-space-x-6 lg:-space-x-8 px-4 h-24 sm:h-32 hover:space-x-0 lg:hover:space-x-2 transition-all duration-300">
          {currentPlayer?.hand.map(card => {
            const isPlayable = activeTurnPlayer?.id === myId && topCard && game.isValidMove(card, topCard, game.activeColor!);
            return (
              <button 
                key={card.id} 
                onClick={() => onCardClick(card)}
                disabled={activeTurnPlayer?.id !== myId}
                className={`group relative transition-all duration-300 focus:outline-none ${activeTurnPlayer?.id === myId ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <HandCardView card={card} isPlayable={Boolean(isPlayable)} />
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Game Logs Corner */}
      <div className="absolute bottom-8 left-4 sm:left-8 w-48 sm:w-64 h-24 sm:h-32 overflow-y-auto flex flex-col-reverse text-[8px] sm:text-[10px] font-mono text-slate-500 bg-slate-950/60 sm:bg-slate-950/40 p-2 sm:p-4 rounded-xl border border-white/5 backdrop-blur-sm pointer-events-auto sm:pointer-events-none md:flex mask-image-gradient z-30">
        {[...(game.messages || [])].reverse().map((msg, i) => (
          <div key={i} className="mb-1 opacity-70">
            {'>'} {msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableCardView({ card }: { card: Card }) {
  const isWild = card.color === 'Wild';
  return (
    <div className={`w-[80px] h-[112px] lg:w-[100px] lg:h-[140px] rounded-xl border-4 border-white shadow-2xl flex flex-col p-1.5 lg:p-2 text-white relative z-10 ${getBgColorClass(card.color)}`}>
      {isWild ? (
        <div className="flex h-full flex-col justify-between">
          <div className="grid grid-cols-2 gap-0.5 w-4 lg:w-5">
            <div className="h-2 w-2 lg:h-2.5 lg:w-2.5 bg-red-500 rounded-full"></div>
            <div className="h-2 w-2 lg:h-2.5 lg:w-2.5 bg-blue-500 rounded-full"></div>
            <div className="h-2 w-2 lg:h-2.5 lg:w-2.5 bg-yellow-500 rounded-full"></div>
            <div className="h-2 w-2 lg:h-2.5 lg:w-2.5 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex-1 flex items-center justify-center text-3xl lg:text-5xl font-black italic underline drop-shadow-md">W</div>
          <div className="h-4 lg:h-5"></div>
        </div>
      ) : (
        <>
          <span className="text-sm lg:text-lg font-black leading-none drop-shadow-md">{getShortValue(card.value)}</span>
          <div className="flex-1 flex items-center justify-center">
             <div className="w-10 h-10 lg:w-14 lg:h-14 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                <span className="text-3xl lg:text-5xl font-black italic drop-shadow-md">{getShortValue(card.value)}</span>
             </div>
          </div>
          <span className="text-sm lg:text-lg font-black leading-none self-end rotate-180 drop-shadow-md">{getShortValue(card.value)}</span>
        </>
      )}
    </div>
  );
}

function HandCardView({ card, isPlayable }: { card: Card, isPlayable: boolean }) {
  const isWild = card.color === 'Wild';
  const baseClasses = "w-[60px] h-[90px] sm:w-[70px] sm:h-[105px] lg:w-[80px] lg:h-[120px] rounded-lg border-2 border-white shadow-xl flex flex-col p-1 text-white transition-transform duration-300 group-hover:-translate-y-6";
  const playableClasses = isPlayable 
    ? "shadow-[0_0_15px_rgba(255,255,255,0.4)] ring-2 ring-white/50 ring-offset-2 ring-offset-slate-900 group-hover:scale-105" 
    : "opacity-60 saturate-50 hover:opacity-100 hover:saturate-100";
    
  return (
    <div className={`${baseClasses} ${playableClasses} ${getBgColorClass(card.color)}`}>
      {isWild ? (
        <div className="flex h-full flex-col justify-between">
          <div className="grid grid-cols-2 gap-0.5 w-3 lg:w-4">
            <div className="h-1.5 w-1.5 lg:h-2 lg:w-2 bg-red-500 rounded-full"></div>
            <div className="h-1.5 w-1.5 lg:h-2 lg:w-2 bg-blue-500 rounded-full"></div>
            <div className="h-1.5 w-1.5 lg:h-2 lg:w-2 bg-yellow-500 rounded-full"></div>
            <div className="h-1.5 w-1.5 lg:h-2 lg:w-2 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex-1 flex items-center justify-center text-2xl lg:text-3xl font-black italic underline drop-shadow-md">W</div>
          <div className="h-3 lg:h-4"></div>
        </div>
      ) : (
        <>
          <div className="font-black text-[10px] lg:text-sm drop-shadow-md text-left">{getShortValue(card.value)}</div>
          <div className="flex-1 flex items-center justify-center text-2xl lg:text-3xl font-black italic drop-shadow-md">
            {getIconValue(card.value)}
          </div>
        </>
      )}
    </div>
  );
}

function getShortValue(value: string) {
  if (value === 'Draw2') return '+2';
  if (value === 'WildDraw4') return '+4';
  if (value === 'Reverse') return 'Rev';
  if (value === 'Skip') return 'Skip';
  return value;
}

function getIconValue(value: string) {
  if (value === 'Draw2') return '+2';
  if (value === 'WildDraw4') return '+4';
  if (value === 'Reverse') return '⇆';
  if (value === 'Skip') return '⊘';
  return value;
}

function getBgColorClass(color: Color) {
  switch (color) {
    case 'Red': return 'bg-red-500';
    case 'Yellow': return 'bg-yellow-500';
    case 'Green': return 'bg-green-500';
    case 'Blue': return 'bg-blue-500';
    case 'Wild': return 'bg-black';
    default: return 'bg-neutral-500';
  }
}

function getGlowClass(color: Color) {
  switch (color) {
    case 'Red': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    case 'Yellow': return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
    case 'Green': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
    case 'Blue': return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
    case 'Wild': return 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]';
    default: return 'bg-neutral-500';
  }
}

