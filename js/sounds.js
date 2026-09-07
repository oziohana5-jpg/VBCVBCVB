// ============================================================
// Paper.io 2 - Sound Engine (Web Audio API, no external files)
// ============================================================
window.PaperSound = (function () {
  'use strict';

  let ctx = null;
  let enabled = true;
  let masterGain = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(ctx.destination);
    }
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ── Low-level helpers ──────────────────────────────────────

  function playTone(opts) {
    if (!enabled) return;
    const c = getCtx();
    const now = c.currentTime;

    const osc  = c.createOscillator();
    const gain = c.createGain();

    osc.type      = opts.type  || 'sine';
    osc.frequency.setValueAtTime(opts.freq || 440, now);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(opts.freqEnd, 1), now + (opts.duration || 0.2)
      );
    }

    gain.gain.setValueAtTime(opts.vol || 0.4, now);
    gain.gain.exponentialRampToValueAtTime(
      0.001, now + (opts.duration || 0.2)
    );

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + (opts.duration || 0.2) + 0.01);
  }

  function playNoise(opts) {
    if (!enabled) return;
    const c   = getCtx();
    const now = c.currentTime;
    const dur = opts.duration || 0.15;

    const bufSize = Math.floor(c.sampleRate * dur);
    const buf     = c.createBuffer(1, bufSize, c.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = c.createBufferSource();
    src.buffer   = buf;

    const filter = c.createBiquadFilter();
    filter.type  = opts.filterType || 'bandpass';
    filter.frequency.value = opts.filterFreq || 800;
    filter.Q.value         = opts.Q || 1;

    const gain = c.createGain();
    gain.gain.setValueAtTime(opts.vol || 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    src.start(now);
    src.stop(now + dur + 0.01);
  }

  // ── Sound effects ──────────────────────────────────────────

  const sounds = {

    // Hit a wall / border
    wallHit: function () {
      playTone({ type: 'square', freq: 180, freqEnd: 80,  duration: 0.12, vol: 0.35 });
      playNoise({ duration: 0.08, filterFreq: 400, vol: 0.2 });
    },

    // Successfully captured territory (trail closed)
    capture: function () {
      playTone({ type: 'sine',   freq: 440, freqEnd: 880, duration: 0.08, vol: 0.3 });
      setTimeout(() => playTone({ type: 'sine', freq: 660, freqEnd: 1320, duration: 0.1, vol: 0.3 }), 80);
      setTimeout(() => playTone({ type: 'sine', freq: 880, freqEnd: 1760, duration: 0.12, vol: 0.25 }), 170);
    },

    // Killed an enemy
    kill: function () {
      playTone({ type: 'sawtooth', freq: 600, freqEnd: 150, duration: 0.18, vol: 0.4 });
      setTimeout(() => playTone({ type: 'square', freq: 300, freqEnd: 100, duration: 0.12, vol: 0.3 }), 100);
    },

    // Player dies
    death: function () {
      playTone({ type: 'sawtooth', freq: 440, freqEnd: 55,  duration: 0.4, vol: 0.5 });
      playNoise({ duration: 0.35, filterFreq: 200, filterType: 'lowpass', vol: 0.4 });
    },

    // Moving / trail tick (subtle)
    move: function () {
      playTone({ type: 'sine', freq: 1200, duration: 0.05, vol: 0.16 });
    },

    // Entered enemy territory
    danger: function () {
      playTone({ type: 'triangle', freq: 300, freqEnd: 200, duration: 0.15, vol: 0.25 });
    },

    // Returned safely to own territory
    safe: function () {
      playTone({ type: 'sine', freq: 523, duration: 0.1, vol: 0.25 });
      setTimeout(() => playTone({ type: 'sine', freq: 659, duration: 0.1, vol: 0.2 }), 90);
    },

    // New best score
    newBest: function () {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => playTone({ type: 'sine', freq: f, duration: 0.15, vol: 0.35 }), i * 120);
      });
    },

    // Another player joined the room
    playerJoin: function () {
      playTone({ type: 'sine', freq: 880, duration: 0.07, vol: 0.2 });
      setTimeout(() => playTone({ type: 'sine', freq: 1100, duration: 0.07, vol: 0.15 }), 70);
    },

    // Another player left the room
    playerLeave: function () {
      playTone({ type: 'sine', freq: 1100, duration: 0.07, vol: 0.15 });
      setTimeout(() => playTone({ type: 'sine', freq: 880, duration: 0.07, vol: 0.1 }), 70);
    },

    // Chat message received
    chat: function () {
      playTone({ type: 'sine', freq: 1320, duration: 0.06, vol: 0.12 });
    },
  };

  // ── Public API ─────────────────────────────────────────────
  return {
    play: function (name) {
      if (sounds[name]) sounds[name]();
    },

    setEnabled: function (val) {
      enabled = !!val;
    },

    isEnabled: function () {
      return enabled;
    },

    toggle: function () {
      enabled = !enabled;
      if (masterGain) {
        masterGain.gain.value = enabled ? 0.6 : 0;
      }
      return enabled;
    },

    setVolume: function (v) {
      getCtx();
      if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
    },

    // Call once on first user interaction to unlock AudioContext
    unlock: function () {
      getCtx();
    },
  };
})();
