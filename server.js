// ============================================================
// Paper.io 2 - Main Server
// Express + Socket.io + Discord OAuth + Regional Rooms
// ============================================================
require('dotenv').config();

const express        = require('express');
const http           = require('http');
const { Server }     = require('socket.io');
const session        = require('express-session');
const passport       = require('passport');
const path           = require('path');
const fs             = require('fs');

// ── Auth router (Discord OAuth) ──────────────────────────────
const authRouter = require('./auth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 10000,
  pingInterval: 5000,
});

const PORT       = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'paperio2_secret_change_me';

// ── Session middleware ────────────────────────────────────────
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// Share express session with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Auth routes ───────────────────────────────────────────────
app.use('/auth', authRouter);

// ── API: current user ─────────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      id:       req.user.id,
      username: req.user.username,
      avatar:   req.user.avatar
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
        : null,
    });
  } else {
    res.json(null);
  }
});

// ── API: room list ────────────────────────────────────────────
app.get('/api/rooms', (req, res) => {
  const list = REGIONS.map(r => {
    const room = rooms[r.id];
    return {
      id:       r.id,
      name:     r.name,
      flag:     r.flag,
      players:  room ? room.players.size : 0,
      max:      MAX_PLAYERS,
      online:   true,
    };
  });
  res.json(list);
});

// ── Serve index for all unknown routes ────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// Room / Multiplayer logic
// ============================================================

const MAX_PLAYERS = 50;

const REGIONS = [
  { id: 'tel-aviv',    name: 'תל אביב',   flag: 'IL' },
  { id: 'jerusalem',   name: 'ירושלים',   flag: 'IL' },
  { id: 'haifa',       name: 'חיפה',      flag: 'IL' },
  { id: 'world',       name: 'כל העולם',  flag: 'GL' },
];

// rooms[regionId] = { players: Map<socketId, playerData>, gameState: {} }
const rooms = {};

REGIONS.forEach(r => {
  rooms[r.id] = {
    id:      r.id,
    name:    r.name,
    players: new Map(),   // socketId -> { id, name, avatar, score, kills, x, y, color, trail }
    ticker:  null,
  };
});

// Assign a unique color per player slot
const PLAYER_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a',
  '#ff5722','#607d8b','#795548','#9c27b0','#03a9f4',
  '#cddc39','#ff9800','#f44336','#2196f3','#4caf50',
];

function getColor(room) {
  const used = new Set([...room.players.values()].map(p => p.color));
  return PLAYER_COLORS.find(c => !used.has(c)) || PLAYER_COLORS[0];
}

function broadcastRoomState(room) {
  const state = {
    players: [...room.players.values()].map(p => ({
      id:     p.id,
      name:   p.name,
      avatar: p.avatar,
      score:  p.score,
      kills:  p.kills,
      color:  p.color,
      skin:   p.skin,
    })),
    count: room.players.size,
  };
  io.to(room.id).emit('room:state', state);
}

// ── Socket.io connection ──────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  let currentRoom = null;

  // ── Join a room ──────────────────────────────────────────
  socket.on('room:join', ({ roomId, playerName, avatar, skin }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }
    if (room.players.size >= MAX_PLAYERS) {
      socket.emit('room:error', { message: 'Room is full (max 50 players)' });
      return;
    }

    // Leave previous room if any
    if (currentRoom) {
      leaveRoom(socket, currentRoom);
    }

    currentRoom = room;
    socket.join(roomId);

    const player = {
      id:     socket.id,
      name:   playerName || 'Player',
      avatar: avatar || null,
      skin:   skin || 'israel',
      score:  0,
      kills:  0,
      color:  skin === 'israel' ? '#0038b8' : getColor(room),
      x:      0,
      y:      0,
      trail:  [],
    };

    room.players.set(socket.id, player);
    console.log(`[room:${roomId}] ${player.name} joined (${room.players.size}/${MAX_PLAYERS})`);

    socket.emit('room:joined', {
      roomId,
      playerId: socket.id,
      color:    player.color,
      players:  [...room.players.values()],
    });

    // Tell everyone else
    socket.to(roomId).emit('player:joined', {
      id:     player.id,
      name:   player.name,
      avatar: player.avatar,
      color:  player.color,
      skin:   player.skin,
    });

    broadcastRoomState(room);
  });

  // ── Player movement update ───────────────────────────────
  socket.on('player:update', (data) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(socket.id);
    if (!player) return;

    player.x     = data.x     ?? player.x;
    player.y     = data.y     ?? player.y;
    player.score = data.score ?? player.score;
    player.trail = data.trail ?? player.trail;

    // Relay to everyone else in the room
    socket.to(currentRoom.id).emit('player:moved', {
      id:    socket.id,
      x:     player.x,
      y:     player.y,
      trail: player.trail,
      score: player.score,
    });
  });

  // ── Kill event ───────────────────────────────────────────
  socket.on('player:kill', ({ victimId }) => {
    if (!currentRoom) return;
    const killer = currentRoom.players.get(socket.id);
    const victim = currentRoom.players.get(victimId);
    if (!killer || !victim) return;

    killer.kills += 1;

    io.to(currentRoom.id).emit('player:killed', {
      killerId:   socket.id,
      killerName: killer.name,
      victimId,
      victimName: victim.name,
    });

    broadcastRoomState(currentRoom);
  });

  // ── Score update ─────────────────────────────────────────
  socket.on('player:score', ({ score }) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(socket.id);
    if (!player) return;
    player.score = score;
    broadcastRoomState(currentRoom);
  });

  // ── Chat message ─────────────────────────────────────────
  socket.on('chat:message', ({ text }) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(socket.id);
    if (!player || !text) return;
    const safe = String(text).slice(0, 120);
    io.to(currentRoom.id).emit('chat:message', {
      from:  player.name,
      color: player.color,
      text:  safe,
      ts:    Date.now(),
    });
  });

  // ── Disconnect ───────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    if (currentRoom) leaveRoom(socket, currentRoom);
  });
});

function leaveRoom(socket, room) {
  const player = room.players.get(socket.id);
  room.players.delete(socket.id);
  socket.leave(room.id);

  if (player) {
    io.to(room.id).emit('player:left', {
      id:   socket.id,
      name: player.name,
    });
  }
  broadcastRoomState(room);
  console.log(`[room:${room.id}] player left (${room.players.size}/${MAX_PLAYERS})`);
}

// ── Start ─────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\nPaper.io 2 server running at http://localhost:${PORT}`);
  console.log('Regions: ' + REGIONS.map(r => r.name).join(', '));
  console.log('Press Ctrl+C to stop.\n');
});
