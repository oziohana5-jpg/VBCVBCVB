// ============================================================
// Paper.io 2 - Game Hooks
// Patches the game engine to emit sound + multiplayer events
// Loaded AFTER app-new-gm.js
// ============================================================
(function () {
  'use strict';

  // Wait until the game engine is ready
  function waitForGame(cb) {
    const check = setInterval(function () {
      if (window._p2_game || window.paper2IO) {
        clearInterval(check);
        cb();
      }
    }, 100);
  }

  // ── Multiplayer client ─────────────────────────────────────
  window.MP = (function () {
    let socket = null;
    let roomId = null;
    let myColor = null;

    function connect(room, playerName, avatar, skin) {
      if (socket && socket.connected) socket.disconnect();

      // Load socket.io client if not already loaded
      if (typeof io === 'undefined') {
        console.warn('[MP] socket.io client not loaded');
        return;
      }

      socket = io({ transports: ['websocket', 'polling'] });
      roomId = room;

      socket.on('connect', function () {
        console.log('[MP] connected, joining room:', room);
        socket.emit('room:join', {
          roomId:     room,
          playerName: playerName || 'Player',
          avatar:     avatar || null,
          skin:       skin || 'israel'
        });
      });

      socket.on('room:joined', function (data) {
        myColor = data.color;
        console.log('[MP] joined room', data.roomId, 'as color', myColor);
        updatePlayerListUI(data.players);
      });

      socket.on('room:state', function (data) {
        updatePlayerListUI(data.players);
        document.getElementById('mp-count').textContent =
          data.count + ' / 50';
      });

      socket.on('room:error', function (data) {
        alert('Server: ' + data.message);
      });

      socket.on('player:joined', function (data) {
        PaperSound.play('playerJoin');
        showToast(data.name + ' joined', data.color);
      });

      socket.on('player:left', function (data) {
        PaperSound.play('playerLeave');
        showToast(data.name + ' left', '#aaa');
      });

      socket.on('player:killed', function (data) {
        if (data.killerId === socket.id) {
          PaperSound.play('kill');
          showToast('You killed ' + data.victimName, '#e74c3c');
        } else if (data.victimId === socket.id) {
          PaperSound.play('death');
        } else {
          showToast(data.killerName + ' killed ' + data.victimName, '#f39c12');
        }
      });

      socket.on('chat:message', function (data) {
        PaperSound.play('chat');
        appendChatMessage(data.from, data.text, data.color);
      });

      socket.on('disconnect', function () {
        console.log('[MP] disconnected');
      });
    }

    function sendUpdate(data) {
      if (socket && socket.connected) socket.emit('player:update', data);
    }

    function sendKill(victimId) {
      if (socket && socket.connected) socket.emit('player:kill', { victimId });
    }

    function sendScore(score) {
      if (socket && socket.connected) socket.emit('player:score', { score });
    }

    function sendChat(text) {
      if (socket && socket.connected) socket.emit('chat:message', { text });
    }

    function disconnect() {
      if (socket) socket.disconnect();
    }

    return { connect, sendUpdate, sendKill, sendScore, sendChat, disconnect,
             getColor: () => myColor, getRoomId: () => roomId };
  })();

  // ── UI helpers ─────────────────────────────────────────────

  function updatePlayerListUI(players) {
    const list = document.getElementById('mp-player-list');
    if (!list) return;
    list.innerHTML = '';
    players.slice(0, 20).forEach(function (p) {
      const li = document.createElement('li');
      li.style.borderLeft = '4px solid ' + p.color;
      li.innerHTML =
        '<span class="mp-pname">' + escHtml(p.name) + '</span>' +
        '<span class="mp-pscore">' + p.score + '%</span>' +
        '<span class="mp-pkills">' + p.kills + ' kills</span>';
      list.appendChild(li);
    });
  }

  function appendChatMessage(from, text, color) {
    const box = document.getElementById('mp-chat-messages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'mp-chat-msg';
    div.innerHTML =
      '<span style="color:' + color + '">' + escHtml(from) + ':</span> ' +
      escHtml(text);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;

    // Keep max 50 messages
    while (box.children.length > 50) box.removeChild(box.firstChild);
  }

  function showToast(msg, color) {
    const t = document.createElement('div');
    t.className = 'mp-toast';
    t.style.borderLeft = '4px solid ' + (color || '#fff');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('mp-toast-hide'); }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Sound patches ──────────────────────────────────────────
  // We intercept known game events by polling / patching globals.

  let lastScore   = 0;
  let lastBest    = 0;
  let inTrail     = false;
  let patchedDone = false;
  let lastMoveSoundAt = 0;
  let deathSoundPlayed = false;

  function patchGameEvents() {
    if (patchedDone) return;
    patchedDone = true;

    // Poll game state every 200ms and fire sounds on changes
    setInterval(function () {
      try {
        // Try to read game state from known global structures
        const g = window._p2_game || (window.paper2IO && window.paper2IO.game);
        if (!g) return;

        const player = g.player || (g.units && g.units[0]);
        if (!player) return;

        const score = player.percent || player.score || 0;

        // Capture sound: score went up
        if (score > lastScore + 0.5) {
          PaperSound.play('capture');
          MP.sendScore(Math.round(score));
        }
        lastScore = score;

        // New best
        const best = g.bestPercent || g.best || 0;
        if (best > lastBest && best > 0) {
          PaperSound.play('newBest');
          lastBest = best;
        }

      } catch (e) { /* game not ready yet */ }
    }, 200);

    // Patch play button to unlock audio
    const playBtn = document.getElementById('play');
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        PaperSound.unlock();
        deathSoundPlayed = false;
      }, { once: true });
    }

    // Browsers require a user gesture. Movement now also gives immediate feedback.
    document.addEventListener('keydown', function (event) {
      if (event.target && /input|textarea/i.test(event.target.tagName)) return;
      PaperSound.unlock();
      if (!/arrow|w|a|s|d/i.test(event.key)) return;
      const now = Date.now();
      if (now - lastMoveSoundAt > 180) {
        PaperSound.play('move');
        lastMoveSoundAt = now;
      }
    });

    document.addEventListener('touchstart', function () {
      PaperSound.unlock();
      PaperSound.play('move');
    }, { passive: true });
    document.addEventListener('pointerdown', function () {
      PaperSound.unlock();
    }, { once: true, passive: true });

    const ui = document.getElementById('ui');
    if (ui) {
      const resultObserver = new MutationObserver(function () {
        const text = ui.textContent || '';
        if (/PLAY AGAIN|GAME OVER/i.test(text) && !deathSoundPlayed) {
          PaperSound.play('death');
          deathSoundPlayed = true;
        }
        if (/KILL|KILLED/i.test(text)) PaperSound.play('kill');
      });
      resultObserver.observe(ui, { childList: true, subtree: true, characterData: true });
    }

    console.log('[hooks] game patches applied');
  }

  // ── Chat input handler ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    const chatInput = document.getElementById('mp-chat-input');
    const chatSend  = document.getElementById('mp-chat-send');

    function sendMsg() {
      if (!chatInput) return;
      const txt = chatInput.value.trim();
      if (!txt) return;
      MP.sendChat(txt);
      appendChatMessage('You', txt, '#7fff7f');
      chatInput.value = '';
    }

    if (chatSend) chatSend.addEventListener('click', sendMsg);
    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); sendMsg(); }
      });
    }

    // Sound toggle button
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        const on = PaperSound.toggle();
        soundBtn.textContent = on ? 'Sound: ON' : 'Sound: OFF';
        soundBtn.classList.toggle('sound-off', !on);
      });
    }

    // Attempt game patches immediately and after short delay
    patchGameEvents();
    setTimeout(patchGameEvents, 1000);
    setTimeout(patchGameEvents, 3000);
  });

})();
