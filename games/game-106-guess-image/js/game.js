/*
 * Game 106 — 你画我猜（马赛克渐清晰）
 *
 * 玩法：题目图片从重度马赛克开始，随时间逐渐变清晰。
 * 玩家从 4 个选项中尽早选出正确答案，越早猜中得分越高。
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 配置                                                                */
  /* ------------------------------------------------------------------ */
  var CFG = {
    ROUNDS: 8,          // 每局题数
    REVEAL_MS: 13000,   // 从全马赛克到全清晰的时长
    GRACE_MS: 4000,     // 完全清晰后仍可作答的宽限时间
    MAX_SCORE: 1000,    // 第 0 秒猜中的满分
    MIN_SCORE: 150,     // 完全清晰时猜中的保底分
    ART: 512,           // 原图分辨率
    MAX_BLOCK: 64,      // 起始马赛克块大小（原图像素）
    WRONG_MULT: 0.5,    // 每猜错一次，本题分值乘以该系数
    MAX_WRONG: 1,       // 每题允许猜错的次数（超过即本题结束）
    COMBO_STEP: 0.1,    // 每层连击的加成
    COMBO_CAP: 0.5,     // 连击加成上限
    BEST_KEY: 'apollo.game106.best'
  };

  var RANKS = [
    { min: 6200, tag: 'S', title: '神之直觉', desc: '几乎在马赛克里就看穿了一切。' },
    { min: 4800, tag: 'A', title: '火眼金睛', desc: '反应又快又准，非常稳。' },
    { min: 3400, tag: 'B', title: '眼力不错', desc: '再快一点就能上 A 了。' },
    { min: 1800, tag: 'C', title: '慢慢来', desc: '多打几局，手感会上来的。' },
    { min: -1, tag: 'D', title: '再试一次', desc: '别急，先熟悉一下题库。' }
  ];

  /* ------------------------------------------------------------------ */
  /* 工具                                                                */
  /* ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ------------------------------------------------------------------ */
  /* 画布 / 马赛克渲染                                                    */
  /* ------------------------------------------------------------------ */
  var screen = $('screen');
  var sctx = screen.getContext('2d');

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  var art = makeCanvas(CFG.ART, CFG.ART);          // 原始清晰图
  var actx = art.getContext('2d');
  var scratchA = makeCanvas(1, 1);                 // 逐级缩小用的乒乓缓冲
  var scratchB = makeCanvas(1, 1);
  var small = makeCanvas(1, 1);                    // 最终的低分辨率图
  var sm = small.getContext('2d');

  function drawArt(subject) {
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, CFG.ART, CFG.ART);
    actx.save();
    actx.scale(CFG.ART, CFG.ART);   // 之后所有绘制都在 0~1 单位坐标系
    subject.draw(actx);
    actx.restore();
  }

  /**
   * 把原图逐级折半缩小到 n×n。
   * 一次性大比例缩小在部分浏览器上会退化成稀疏采样，
   * 逐级折半可以得到接近盒式滤波的平均效果，马赛克块的颜色才准确。
   */
  function downscale(n) {
    var cur = art, w = CFG.ART, i = 0;
    while (Math.floor(w / 2) > n) {
      var dst = (i++ % 2 === 0) ? scratchA : scratchB;
      var nw = Math.floor(w / 2);
      dst.width = nw; dst.height = nw;
      var c = dst.getContext('2d');
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(cur, 0, 0, nw, nw);
      cur = dst; w = nw;
    }
    small.width = n; small.height = n;
    sm.imageSmoothingEnabled = true;
    sm.imageSmoothingQuality = 'high';
    sm.drawImage(cur, 0, 0, n, n);
  }

  var lastN = -1;

  function paint(n, force) {
    if (n !== lastN || force) {
      downscale(n);
      lastN = n;
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.imageSmoothingEnabled = false;   // 关键：放大时保留硬边马赛克
    sctx.clearRect(0, 0, screen.width, screen.height);
    sctx.drawImage(small, 0, 0, n, n, 0, 0, screen.width, screen.height);
  }

  function resizeScreen() {
    var rect = screen.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.max(1, Math.round(rect.width * dpr));
    if (screen.width !== px) {
      screen.width = px;
      screen.height = px;
      paint(lastN > 0 ? lastN : 8, true);
    }
  }

  /** 清晰度 t(0~1) → 马赛克块边长（原图像素），指数衰减 64→1 */
  function blockAt(t) {
    return clamp(Math.round(Math.pow(CFG.MAX_BLOCK, 1 - t)), 1, CFG.MAX_BLOCK);
  }

  function gridAt(t) {
    return clamp(Math.round(CFG.ART / blockAt(t)), 1, CFG.ART);
  }

  /* ------------------------------------------------------------------ */
  /* 状态                                                                */
  /* ------------------------------------------------------------------ */
  var S = {
    running: false,
    round: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    hits: 0,
    clarities: [],      // 每道答对时的清晰度
    queue: [],
    subject: null,
    options: [],
    startAt: 0,
    wrong: 0,
    settled: false,
    raf: 0
  };

  /* ------------------------------------------------------------------ */
  /* 出题                                                                */
  /* ------------------------------------------------------------------ */
  function buildQueue() {
    var pool = shuffle(ARTWORK.SUBJECTS);
    return pool.slice(0, Math.min(CFG.ROUNDS, pool.length));
  }

  function buildOptions(subject) {
    var all = ARTWORK.SUBJECTS;
    var sameCat = shuffle(all.filter(function (s) {
      return s.cat === subject.cat && s.id !== subject.id;
    }));
    var others = shuffle(all.filter(function (s) {
      return s.cat !== subject.cat;
    }));
    // 干扰项优先取同类别的，猜起来才有难度
    var picks = sameCat.slice(0, 3);
    while (picks.length < 3 && others.length) picks.push(others.pop());
    return shuffle(picks.concat([subject]));
  }

  /* ------------------------------------------------------------------ */
  /* 计分                                                                */
  /* ------------------------------------------------------------------ */
  function potentialAt(t) {
    var raw = CFG.MAX_SCORE - (CFG.MAX_SCORE - CFG.MIN_SCORE) * clamp(t, 0, 1);
    return Math.round(raw * Math.pow(CFG.WRONG_MULT, S.wrong));
  }

  function comboMult() {
    return 1 + Math.min(S.streak * CFG.COMBO_STEP, CFG.COMBO_CAP);
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  var el = {
    round: $('hudRound'), score: $('hudScore'), streak: $('hudStreak'),
    clarityFill: $('clarityFill'), clarityVal: $('clarityVal'),
    potential: $('potentialVal'), potentialWrap: $('potential'),
    options: $('options'), verdict: $('verdict'),
    stage: $('stage'), combo: $('comboBadge')
  };

  function renderHud() {
    el.round.textContent = Math.min(S.round + 1, CFG.ROUNDS) + '/' + CFG.ROUNDS;
    el.score.textContent = S.score;
    el.streak.textContent = S.streak;
    el.combo.classList.toggle('on', S.streak >= 2);
    el.combo.textContent = S.streak >= 2 ? ('连击 ×' + comboMult().toFixed(1)) : '';
  }

  /* ------------------------------------------------------------------ */
  /* 回合                                                                */
  /* ------------------------------------------------------------------ */
  function startRound() {
    S.subject = S.queue[S.round];
    S.options = buildOptions(S.subject);
    S.wrong = 0;
    S.settled = false;
    lastN = -1;

    drawArt(S.subject);
    renderOptions();
    renderHud();
    hideVerdict();
    el.stage.classList.remove('is-over');

    S.startAt = performance.now();
    loop();
  }

  function renderOptions() {
    el.options.innerHTML = '';
    S.options.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.className = 'opt';
      b.type = 'button';
      b.dataset.id = opt.id;
      b.innerHTML = '<span class="opt-key">' + (i + 1) + '</span><span class="opt-name">' +
        opt.name + '</span>';
      b.addEventListener('click', function () { guess(opt, b); });
      el.options.appendChild(b);
    });
  }

  var lastTickBucket = -1;

  function loop() {
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(function step() {
      if (!S.running || S.settled) return;
      var elapsed = performance.now() - S.startAt;
      var t = clamp(elapsed / CFG.REVEAL_MS, 0, 1);

      paint(gridAt(t));

      var pct = Math.round(t * 100);
      el.clarityFill.style.width = pct + '%';
      el.clarityVal.textContent = pct + '%';
      var p = potentialAt(t);
      el.potential.textContent = p;
      el.potentialWrap.classList.toggle('low', t > 0.66);

      var bucket = Math.floor(t * 10);
      if (bucket !== lastTickBucket && t < 1) {
        lastTickBucket = bucket;
        if (bucket > 0) SFX.tick();
      }

      if (elapsed >= CFG.REVEAL_MS + CFG.GRACE_MS) {
        settle(null, 0);
        return;
      }
      S.raf = requestAnimationFrame(step);
    });
  }

  function guess(opt, btn) {
    if (S.settled) return;
    var t = clamp((performance.now() - S.startAt) / CFG.REVEAL_MS, 0, 1);

    if (opt.id === S.subject.id) {
      var gained = Math.round(potentialAt(t) * comboMult());
      settle(opt, gained, t);
      return;
    }

    S.wrong++;
    btn.classList.add('is-wrong');
    btn.disabled = true;
    el.stage.classList.add('shake');
    setTimeout(function () { el.stage.classList.remove('shake'); }, 340);

    if (S.wrong > CFG.MAX_WRONG) {
      SFX.fail();
      settle(opt, 0, t);
    } else {
      SFX.wrong();
      floatText('-' + Math.round((1 - CFG.WRONG_MULT) * 100) + '% 分值', 'bad');
    }
  }

  function settle(picked, gained, t) {
    if (S.settled) return;
    S.settled = true;
    cancelAnimationFrame(S.raf);

    var correct = !!picked && picked.id === S.subject.id;
    var timedOut = picked === null;

    if (correct) {
      S.hits++;
      S.score += gained;
      S.streak++;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      S.clarities.push(t);
      SFX.correct(S.streak);
    } else {
      S.streak = 0;
      if (timedOut) SFX.timeout();
    }

    // 揭晓：立刻恢复到完全清晰
    paint(CFG.ART);
    SFX.reveal();
    el.stage.classList.add('is-over');
    el.clarityFill.style.width = '100%';
    el.clarityVal.textContent = '100%';

    Array.prototype.forEach.call(el.options.children, function (b) {
      b.disabled = true;
      if (b.dataset.id === S.subject.id) b.classList.add('is-right');
    });

    showVerdict(correct, timedOut, gained, t);
    renderHud();

    setTimeout(function () {
      S.round++;
      if (S.round >= CFG.ROUNDS) finish();
      else startRound();
    }, correct ? 1500 : 2000);
  }

  function showVerdict(correct, timedOut, gained, t) {
    var head = correct ? '答对！' : (timedOut ? '时间到' : '答错了');
    var sub;
    if (correct) {
      sub = '在 ' + Math.round(t * 100) + '% 清晰度识破 · 答案：' + S.subject.name;
    } else {
      sub = '正确答案：' + S.subject.name;
    }
    el.verdict.className = 'verdict show ' + (correct ? 'good' : 'bad');
    el.verdict.innerHTML =
      '<div class="v-head">' + head + '</div>' +
      (correct ? '<div class="v-score">+' + gained + '</div>' : '') +
      '<div class="v-sub">' + sub + '</div>' +
      (correct && S.streak >= 2 ? '<div class="v-combo">连击 ×' + comboMult().toFixed(1) + ' 已计入</div>' : '');
  }

  function hideVerdict() { el.verdict.className = 'verdict'; }

  function floatText(text, kind) {
    var f = document.createElement('div');
    f.className = 'floater ' + (kind || '');
    f.textContent = text;
    el.stage.appendChild(f);
    setTimeout(function () { f.remove(); }, 900);
  }

  /* ------------------------------------------------------------------ */
  /* 开始 / 结束                                                          */
  /* ------------------------------------------------------------------ */
  function startGame() {
    SFX.unlock();
    S.running = true;
    S.round = 0; S.score = 0; S.streak = 0; S.bestStreak = 0;
    S.hits = 0; S.clarities = [];
    S.queue = buildQueue();
    lastTickBucket = -1;

    $('screenStart').classList.remove('show');
    $('screenEnd').classList.remove('show');
    document.body.classList.add('playing');
    resizeScreen();
    SFX.start();
    startRound();
  }

  function readBest() {
    try { return parseInt(localStorage.getItem(CFG.BEST_KEY) || '0', 10) || 0; }
    catch (e) { return 0; }
  }

  function writeBest(v) {
    try { localStorage.setItem(CFG.BEST_KEY, String(v)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function finish() {
    S.running = false;
    document.body.classList.remove('playing');
    cancelAnimationFrame(S.raf);

    var best = readBest();
    var isNewBest = S.score > best;
    if (isNewBest) { best = S.score; writeBest(best); }

    var rank = RANKS.find(function (r) { return S.score >= r.min; });
    var avgClarity = S.clarities.length
      ? Math.round(S.clarities.reduce(function (a, b) { return a + b; }, 0) / S.clarities.length * 100)
      : 0;

    $('endRank').textContent = rank.tag;
    $('endRank').className = 'rank rank-' + rank.tag;
    $('endTitle').textContent = rank.title;
    $('endDesc').textContent = rank.desc;
    $('endScore').textContent = S.score;
    $('endHits').textContent = S.hits + '/' + CFG.ROUNDS;
    $('endClarity').textContent = S.clarities.length ? avgClarity + '%' : '—';
    $('endStreak').textContent = S.bestStreak;
    $('endBest').textContent = best;
    $('endNewBest').classList.toggle('show', isNewBest);

    $('screenEnd').classList.add('show');
    SFX.finish();
  }

  /* ------------------------------------------------------------------ */
  /* 交互绑定                                                            */
  /* ------------------------------------------------------------------ */
  $('btnStart').addEventListener('click', startGame);
  $('btnAgain').addEventListener('click', startGame);
  $('btnQuit').addEventListener('click', function () {
    S.running = false;
    S.settled = true;
    cancelAnimationFrame(S.raf);
    document.body.classList.remove('playing');
    $('screenStart').classList.add('show');
    startPreview();
  });

  var btnSound = $('btnSound');
  btnSound.addEventListener('click', function () {
    var on = !SFX.isEnabled();
    SFX.setEnabled(on);
    btnSound.classList.toggle('off', !on);
    btnSound.textContent = on ? '♪ 音效开' : '♪ 音效关';
    if (on) SFX.hover();
  });

  document.addEventListener('keydown', function (e) {
    if (!S.running) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if ($('screenStart').classList.contains('show')) startGame();
        else if ($('screenEnd').classList.contains('show')) startGame();
      }
      return;
    }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) {
      var btn = el.options.children[n - 1];
      if (btn && !btn.disabled) btn.click();
    }
  });

  window.addEventListener('resize', resizeScreen);

  /* 起始屏放一张示意图来回糊/清，直观展示玩法 */
  var previewRaf = 0;

  function startPreview() {
    cancelAnimationFrame(previewRaf);
    resizeScreen();
    var demo = ARTWORK.SUBJECTS[Math.floor(Math.random() * ARTWORK.SUBJECTS.length)];
    drawArt(demo);
    lastN = -1;
    var t = 0, dir = 1;
    (function tick() {
      if (S.running) return;   // 游戏开始后停止预览动画
      t += 0.006 * dir;
      if (t >= 1) { t = 1; dir = -1; }
      if (t <= 0) { t = 0; dir = 1; }
      paint(gridAt(t));
      previewRaf = requestAnimationFrame(tick);
    })();
  }

  startPreview();

  /* 调试 / 自动化测试用的只读句柄 */
  window.G106 = {
    cfg: CFG,
    state: S,
    answer: function () { return S.subject && S.subject.name; }
  };
})();
