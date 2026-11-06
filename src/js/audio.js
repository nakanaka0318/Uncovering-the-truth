'use strict';
/* ===== 音：Web Audio による生成BGMと効果音 ===== */

const Audio2 = (() => {
  let ctx = null, master, bgmGain, sfxGain, reverb;
  let bgmOn = true, sfxOn = true;
  let mood = 'title';
  let timer = null;
  let nextChordAt = 0, chordIdx = 0, nextBellAt = 0, nextPulseAt = 0;
  let droneNodes = [];
  let lastTick = 0;

  const MOODS = {
    title: { root: 38, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], chordLen: 7.5, bell: 13, pulse: 0, vol: 0.5 },
    trial: { root: 38, prog: [[0, 3, 7], [1, 5, 8], [-2, 1, 5], [-5, -1, 2]], chordLen: 6.5, bell: 17, pulse: 2.2, vol: 0.42 },
    boss: { root: 36, prog: [[0, 3, 6], [1, 4, 8], [0, 3, 7], [-1, 2, 6]], chordLen: 4.5, bell: 9, pulse: 1.1, vol: 0.5 },
    calm: { root: 41, prog: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], chordLen: 8, bell: 20, pulse: 0, vol: 0.38 },
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(3.2, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.55; reverb.connect(wet); wet.connect(master);
    bgmGain = ctx.createGain(); bgmGain.gain.value = bgmOn ? MOODS[mood].vol : 0;
    bgmGain.connect(master); bgmGain.connect(reverb);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxOn ? 0.9 : 0;
    sfxGain.connect(master);
    const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.25; sfxGain.connect(sfxSend); sfxSend.connect(reverb);
    startDrone();
    nextChordAt = ctx.currentTime + 0.2;
    nextBellAt = ctx.currentTime + 2;
    nextPulseAt = ctx.currentTime + 1;
    timer = setInterval(schedule, 200);
  }

  function startDrone() {
    droneNodes.forEach((n) => { try { n.stop(); } catch (e) { /* */ } });
    droneNodes = [];
    const m = MOODS[mood];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 4);
    lp.connect(g); g.connect(bgmGain);
    [0, 0.07, 12.02].forEach((det, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = mtof(m.root - 12 + det);
      o.connect(lp); o.start();
      droneNodes.push(o);
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    droneNodes.push(lfo);
    // 風
    const nz = noise(); nz.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.018;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05;
    const lfo2g = ctx.createGain(); lfo2g.gain.value = 300;
    lfo2.connect(lfo2g); lfo2g.connect(bp.frequency); lfo2.start();
    nz.connect(bp); bp.connect(ng); ng.connect(bgmGain); nz.start();
    droneNodes.push(nz, lfo2);
  }

  function organChord(t, notes, len) {
    notes.forEach((n, idx) => {
      const f = mtof(MOODS[mood].root + 12 + n);
      [1, 2, 3].forEach((h, hi) => {
        const o = ctx.createOscillator();
        o.type = hi === 0 ? 'triangle' : 'sine';
        o.frequency.value = f * h * (1 + (idx - 1) * 0.0008);
        const g = ctx.createGain();
        const peak = [0.05, 0.022, 0.01][hi];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 1.6);
        g.gain.setValueAtTime(peak, t + len - 1.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.8);
        o.connect(g); g.connect(bgmGain);
        o.start(t); o.stop(t + len + 1);
      });
    });
  }

  function bell(t, midi, vol, dest) {
    const f = mtof(midi);
    [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.18], [0.5, 0.4]].forEach(([r, a]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5 / Math.sqrt(r));
      o.connect(g); g.connect(dest || bgmGain);
      o.start(t); o.stop(t + 5);
    });
  }

  function pulse(t) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + 0.6);
  }

  function schedule() {
    if (!ctx) return;
    const now = ctx.currentTime, m = MOODS[mood];
    while (nextChordAt < now + 0.6) {
      organChord(nextChordAt, m.prog[chordIdx % m.prog.length], m.chordLen);
      chordIdx++;
      nextChordAt += m.chordLen;
    }
    if (nextBellAt < now + 0.6) {
      bell(nextBellAt, m.root + 24 + [0, 7, 12, 3][Math.floor(Math.random() * 4)], 0.05);
      nextBellAt += m.bell * (0.7 + Math.random() * 0.6);
    }
    if (m.pulse && nextPulseAt < now + 0.6) {
      pulse(nextPulseAt);
      pulse(nextPulseAt + 0.28);
      nextPulseAt += m.pulse;
    } else if (!m.pulse) nextPulseAt = now + 1;
  }

  function setMood(mo) {
    if (mo === mood || !MOODS[mo]) { mood = mo in MOODS ? mo : mood; return; }
    mood = mo;
    if (!ctx) return;
    bgmGain.gain.setTargetAtTime(bgmOn ? MOODS[mood].vol : 0, ctx.currentTime, 0.8);
    startDrone();
    nextChordAt = ctx.currentTime + 0.5;
  }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  const sfx = {
    flip() {
      const t = ctx.currentTime;
      const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
      const g = ctx.createGain(); env(g, t, 0.01, 0.35, 0.16);
      n.connect(bp); bp.connect(g); g.connect(sfxGain); n.start(t); n.stop(t + 0.3);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(180, t + 0.12); o.frequency.exponentialRampToValueAtTime(80, t + 0.25);
      const g2 = ctx.createGain(); env(g2, t + 0.12, 0.005, 0.3, 0.18);
      o.connect(g2); g2.connect(sfxGain); o.start(t + 0.1); o.stop(t + 0.4);
    },
    tick() {
      const t = ctx.currentTime;
      if (t - lastTick < 0.045) return;
      lastTick = t;
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = 1800 + Math.random() * 500;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
      const g = ctx.createGain(); env(g, t, 0.001, 0.025, 0.025);
      o.connect(hp); hp.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.05);
    },
    select() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 660;
      const g = ctx.createGain(); env(g, t, 0.005, 0.08, 0.12);
      o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.2);
    },
    mark() {
      const t = ctx.currentTime;
      const n = noise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); env(g, t, 0.003, 0.25, 0.08);
      n.connect(lp); lp.connect(g); g.connect(sfxGain); n.start(t); n.stop(t + 0.15);
    },
    execute() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
      const g = ctx.createGain(); env(g, t, 0.01, 0.8, 1.0);
      o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 1.2);
      const n = noise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.6);
      const g2 = ctx.createGain(); env(g2, t, 0.005, 0.5, 0.7);
      n.connect(lp); lp.connect(g2); g2.connect(sfxGain); n.start(t); n.stop(t + 0.9);
      bell(t + 0.02, 33, 0.12, sfxGain);
    },
    good() {
      const t = ctx.currentTime;
      [62, 69, 74, 78].forEach((m, i) => bell(t + i * 0.09, m, 0.07, sfxGain));
    },
    bad() {
      const t = ctx.currentTime;
      [44, 45, 50].forEach((m) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
        const g = ctx.createGain(); env(g, t, 0.02, 0.12, 1.3);
        o.connect(lp); lp.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 1.5);
      });
    },
    coin() {
      const t = ctx.currentTime;
      [88, 95].forEach((m, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
        const g = ctx.createGain(); env(g, t + i * 0.07, 0.002, 0.08, 0.3);
        o.connect(g); g.connect(sfxGain); o.start(t + i * 0.07); o.stop(t + 0.5);
      });
    },
    item() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(400, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.4);
      const g = ctx.createGain(); env(g, t, 0.05, 0.1, 0.5);
      o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.7);
      bell(t + 0.3, 81, 0.04, sfxGain);
    },
    victory() {
      const t = ctx.currentTime;
      [50, 57, 62, 66, 69, 74].forEach((m, i) => bell(t + i * 0.16, m, 0.07, sfxGain));
    },
    gameover() {
      const t = ctx.currentTime;
      [38, 37, 33].forEach((m, i) => bell(t + i * 0.7, m, 0.12, sfxGain));
    },
  };

  function play(name) {
    if (!ctx || !sfxOn || !sfx[name]) return;
    try { sfx[name](); } catch (e) { /* 再生に失敗しても続行 */ }
  }

  return {
    init, play, setMood,
    setBgm(on) { bgmOn = on; if (ctx) bgmGain.gain.setTargetAtTime(on ? MOODS[mood].vol : 0, ctx.currentTime, 0.3); },
    setSfx(on) { sfxOn = on; if (ctx) sfxGain.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05); },
  };
})();
