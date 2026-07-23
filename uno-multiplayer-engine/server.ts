import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { parse } from 'url';
import { UnoGame, Player } from './lib/uno-engine';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer);

  // Store active games in memory
  // roomCode -> UnoGame instance
  const games: Record<string, UnoGame> = {};
  const roomHost: Record<string, string> = {}; // roomCode -> host socket id

  const processBotTurn = (roomCode: string) => {
    const game = games[roomCode];
    if (!game || game.winner) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer && currentPlayer.isBot) {
      setTimeout(() => {
        const currentGame = games[roomCode];
        if (!currentGame || currentGame.winner) return;
        const nowTurnPlayer = currentGame.players[currentGame.currentPlayerIndex];
        if (nowTurnPlayer && nowTurnPlayer.id === currentPlayer.id) {
          try {
            currentGame.makeBotMove(currentPlayer.id);
            io.to(roomCode).emit('game_state_update', currentGame);
            processBotTurn(roomCode);
          } catch (e: any) {
            console.error("Bot turn execution error:", e.message);
          }
        }
      }, 1200);
    }
  };

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create_room', (playerName: string, callback) => {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      socket.join(roomCode);
      socket.data.playerName = playerName;
      socket.data.roomCode = roomCode;
      
      // Initialize an empty game container
      games[roomCode] = new UnoGame([playerName]);
      // Override the auto-initialized game since we want a lobby first
      games[roomCode].players = [{ id: socket.id, name: playerName, hand: [], isBot: false }];
      games[roomCode].deck = []; // clear deck so we know it's lobby state
      roomHost[roomCode] = socket.id;

      callback({ roomCode, players: games[roomCode].players.map(p => ({id: p.id, name: p.name, isBot: p.isBot})) });
    });

    socket.on('join_room', (data: {roomCode: string, playerName: string}, callback) => {
      const { roomCode, playerName } = data;
      const game = games[roomCode];
      
      if (!game) {
        callback({ error: 'Room not found' });
        return;
      }

      if (game.deck.length > 0) {
        callback({ error: 'Game already in progress' });
        return;
      }

      if (game.players.length >= 10) {
        callback({ error: 'Room is full' });
        return;
      }

      socket.join(roomCode);
      socket.data.playerName = playerName;
      socket.data.roomCode = roomCode;

      game.players.push({ id: socket.id, name: playerName, hand: [], isBot: false });
      
      const playerList = game.players.map(p => ({id: p.id, name: p.name, isBot: p.isBot}));
      io.to(roomCode).emit('player_joined', playerList);
      callback({ success: true, players: playerList });
    });

    socket.on('add_bot', (roomCode: string, callback) => {
      const game = games[roomCode];
      if (!game) { callback?.({ error: 'Room not found' }); return; }
      if (roomHost[roomCode] !== socket.id) { callback?.({ error: 'Only host can add bots' }); return; }
      if (game.deck.length > 0) { callback?.({ error: 'Game already in progress' }); return; }
      if (game.players.length >= 10) { callback?.({ error: 'Room is full' }); return; }

      const botCount = game.players.filter(p => p.isBot).length;
      const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const botName = `Bot ${botCount + 1}`;

      game.players.push({ id: botId, name: botName, hand: [], isBot: true });

      const playerList = game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot }));
      io.to(roomCode).emit('player_joined', playerList);
      callback?.({ success: true, players: playerList });
    });

    socket.on('remove_bot', (data: { roomCode: string, botId: string }, callback) => {
      const { roomCode, botId } = data;
      const game = games[roomCode];
      if (!game) { callback?.({ error: 'Room not found' }); return; }
      if (roomHost[roomCode] !== socket.id) { callback?.({ error: 'Only host can remove bots' }); return; }
      if (game.deck.length > 0) { callback?.({ error: 'Game already in progress' }); return; }

      game.players = game.players.filter(p => p.id !== botId);

      const playerList = game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot }));
      io.to(roomCode).emit('player_joined', playerList);
      callback?.({ success: true, players: playerList });
    });

    socket.on('start_game', (roomCode) => {
      const game = games[roomCode];
      if (!game) return;
      if (roomHost[roomCode] !== socket.id) return;
      if (game.players.length < 2) return;
      
      const playerNames = game.players.map(p => p.name);
      
      // Re-initialize with actual players to start the game
      const newGame = new UnoGame(playerNames);
      // Map the generated player IDs back to socket IDs and bot flags
      newGame.players.forEach((p, i) => {
        p.id = game.players[i].id;
        p.isBot = game.players[i].isBot;
      });
      games[roomCode] = newGame;

      io.to(roomCode).emit('game_started', newGame);
      processBotTurn(roomCode);
    });

    socket.on('play_card', (data: {roomCode: string, cardId: string, chosenWildColor?: any}) => {
      const { roomCode, cardId, chosenWildColor } = data;
      const game = games[roomCode];
      if (!game) return;

      try {
        game.playCard(socket.id, cardId, chosenWildColor);
        io.to(roomCode).emit('game_state_update', game);
        processBotTurn(roomCode);
      } catch (err: any) {
        socket.emit('error_message', err.message);
      }
    });

    socket.on('draw_card', (roomCode) => {
      const game = games[roomCode];
      if (!game) return;
      
      try {
        if (game.players[game.currentPlayerIndex].id !== socket.id) {
          throw new Error("Not your turn!");
        }
        game.drawForCurrentPlayer();
        io.to(roomCode).emit('game_state_update', game);
        processBotTurn(roomCode);
      } catch (err: any) {
        socket.emit('error_message', err.message);
      }
    });

    socket.on('say_uno', (roomCode) => {
      const game = games[roomCode];
      if (!game) return;
      // Basic UNO! button implementation
      io.to(roomCode).emit('game_message', `${socket.data.playerName} yelled UNO!`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const roomCode = socket.data.roomCode;
      if (roomCode && games[roomCode]) {
        const game = games[roomCode];
        // If in lobby, remove player
        if (game.deck.length === 0) {
          game.players = game.players.filter(p => p.id !== socket.id);
          if (game.players.length === 0 || game.players.every(p => p.isBot)) {
            delete games[roomCode];
            delete roomHost[roomCode];
          } else {
            if (roomHost[roomCode] === socket.id) {
              const humanHost = game.players.find(p => !p.isBot);
              if (humanHost) {
                roomHost[roomCode] = humanHost.id; // Assign new human host
              } else {
                delete games[roomCode];
                delete roomHost[roomCode];
              }
            }
            io.to(roomCode).emit('player_joined', game.players.map(p => ({id: p.id, name: p.name, isBot: p.isBot})));
          }
        } else {
          io.to(roomCode).emit('game_message', `${socket.data.playerName} disconnected.`);
        }
      }
    });
  });

  server.all(/(.*)/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> Ready on http://0.0.0.0:${port}`);
  });
});
