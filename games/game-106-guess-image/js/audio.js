/*
 * Game 106 — 音效
 * 全部用 WebAudio 现场合成，不加载任何音频文件。
 */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ac() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gain) {
    var a = ac();
    if (!a || !enabled) return;
    var t0 = a.currentTime + start;
    var osc = a.createOscillator();
    var g = a.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.14, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sweep(from, to, dur, type, gain) {
    var a = ac();
    if (!a || !enabled) return;
    var t0 = a.currentTime;
    var osc = a.createOscillator();
    var g = a.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  var SFX = {
    unlock: function () { ac(); },
    tick: function () { tone(880, 0, 0.05, 'square', 0.045); },
    hover: function () { tone(520, 0, 0.04, 'triangle', 0.05); },
    start: function () {
      tone(392, 0, 0.10, 'square', 0.12);
      tone(523, 0.09, 0.10, 'square', 0.12);
      tone(784, 0.18, 0.22, 'square', 0.13);
    },
    correct: function (streak) {
      var base = 523.25 * Math.pow(1.0595, Math.min(streak || 0, 8));
      tone(base, 0, 0.09, 'square', 0.13);
      tone(base * 1.26, 0.08, 0.09, 'square', 0.13);
      tone(base * 1.5, 0.16, 0.26, 'square', 0.14);
    },
    wrong: function () {
      tone(196, 0, 0.12, 'sawtooth', 0.10);
      tone(147, 0.10, 0.22, 'sawtooth', 0.10);
    },
    fail: function () { sweep(320, 70, 0.55, 'sawtooth', 0.11); },
    timeout: function () {
      tone(330, 0, 0.14, 'square', 0.10);
      tone(262, 0.13, 0.14, 'square', 0.10);
      tone(196, 0.26, 0.34, 'square', 0.10);
    },
    reveal: function () { sweep(180, 900, 0.35, 'triangle', 0.07); },
    finish: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < notes.length; i++) tone(notes[i], i * 0.14, 0.3, 'square', 0.13);
    },
    setEnabled: function (v) { enabled = v; },
    isEnabled: function () { return enabled; }
  };

  global.SFX = SFX;
})(window);
