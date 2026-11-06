'use strict';
/* ===== ゲーム進行：ラン・審判・報酬・保存 ===== */

const RUN_KEY = 'itsuwari-no-tei/run/v1';
const META_KEY = 'itsuwari-no-tei/meta/v1';

const Game = (() => {
  let meta = null;
  let run = null;
  const listeners = [];

  function defaultMeta() {
    return {
      trialsCleared: 0, runs: 0, wins: 0, maxRank: 0, bestChapter: -1,
      evilCaught: 0, misExec: 0, tutorialDone: false,
      flags: {}, newUnlocks: [],
      settings: { bgm: true, sfx: true, speed: 1 },
    };
  }
  function loadMeta() {
    meta = Object.assign(defaultMeta(), store.get(META_KEY, {}));
    meta.settings = Object.assign(defaultMeta().settings, meta.settings || {});
    meta.flags = meta.flags || {};
    return meta;
  }
  const saveMeta = () => store.set(META_KEY, meta);
  const saveRun = () => { if (run && run.tutorial) return; if (run) store.set(RUN_KEY, run); else store.del(RUN_KEY); };
  function loadRun() {
    const r = store.get(RUN_KEY, null);
    run = r && r.v === 1 ? r : null;
    return run;
  }
  const emit = (ev, data) => listeners.forEach((f) => f(ev, data));

  /* ----- 解禁 ----- */
  const roleUnlocked = (r) => (r.unlock || 0) <= meta.trialsCleared || (r.complex && !!meta.flags.abyss) || (r.extraOnly && !!meta.flags.abyss);
  function relicUnlocked(rl) {
    const u = rl.unlock;
    if (u === 'base') return true;
    if (u[0] === 't') return meta.trialsCleared >= +u.slice(1);
    return !!meta.flags[u];
  }
  function pools(extra) {
    const un = extra ? ROLES.filter((r) => !r.finalOnly && !r.extraOnly) : ROLES.filter(roleUnlocked);
    return {
      good: un.filter((r) => r.align === 'good').map((r) => r.id),
      med: un.filter((r) => r.align === 'med').map((r) => r.id),
      minion: un.filter((r) => r.align === 'minion').map((r) => r.id),
    };
  }
  function checkUnlocks(before) {
    const now = [];
    ROLES.forEach((r) => { if (r.unlock && r.unlock > before.t && r.unlock <= meta.trialsCleared) now.push({ kind: 'role', id: r.id }); });
    RELICS.forEach((rl) => { if (!before.relics.has(rl.id) && relicUnlocked(rl)) now.push({ kind: 'relic', id: rl.id }); });
    return now;
  }
  const unlockSnapshot = () => ({ t: meta.trialsCleared, relics: new Set(RELICS.filter(relicUnlocked).map((r) => r.id)) });

  /* ----- ラン ----- */
  function newRun(rank) {
    const seed = Math.floor(Math.random() * 1e9);
    const maxCred = BASE_CRED - (rank >= 1 ? 1 : 0);
    run = {
      v: 1, seed, rank, chapter: 0, trialIdx: 0,
      cred: maxCred, maxCred, silver: 10,
      relics: [], items: ['holywater'], slots: 3,
      phase: 'trial', trial: null, reward: null, shop: null, step: 0,
      stats: { trials: 0, evil: 0, mis: 0, flips: 0 },
      log: [],
    };
    meta.runs++;
    saveMeta();
    startTrial();
    return run;
  }
  const has = (id) => run && run.relics.includes(id);
  const rng = (tag) => new RNG(run.seed + ':' + tag + ':' + run.step);

  function trialSpec() {
    const ch = CHAPTERS[run.chapter];
    const base = ch.trials[run.trialIdx];
    const r = rng('spec');
    let boss = null;
    if (base.boss) {
      if (ch.boss === 'any') {
        const cands = ['wolfking', 'bishop', 'masked'].filter((b) => roleUnlocked(ROLE[b]));
        boss = r.pick(cands);
      } else if (ch.boss === 'masked' && !roleUnlocked(ROLE.masked) && !ch.extra) boss = 'wolfking';
      else boss = ch.boss;
    }
    let k = base.k, m = base.m;
    const n = base.R * base.C;
    if (run.rank >= 2 && run.chapter >= 1) m += 1;
    if (run.rank >= 4 && run.chapter >= 2) k = Math.min(k + 1, Math.floor(n / 3) + 1);
    const afflictCount = { wolfking: 1, bishop: 2, lord: 2, hollow: 2, thousand: 1 }[boss] || 0;
    let maxAmb = 1;
    if (run.chapter >= 1) maxAmb = r.chance(0.3) ? 2 : 1;
    if (ch.final) maxAmb = r.chance(0.5) ? 2 : 1;
    if (ch.extra) maxAmb = r.chance(0.35) ? 2 : 1;
    return { R: base.R, C: base.C, k, m, boss, afflictCount, maxAmb, chapter: run.chapter, lurk: base.lurk || 0, complex: !!base.complex, extra: !!ch.extra };
  }

  function startTrial() {
    const spec = trialSpec();
    if (spec.extra && !meta.flags.abyss) { meta.flags.abyss = true; saveMeta(); }
    const res = generateTrial(spec, pools(spec.extra), run.seed + ':trial:' + run.step);
    const r = rng('names');
    const names = r.sample(NAMES, spec.R * spec.C);
    const cards = res.w.cards.map((c, x) => ({
      i: c.i, name: names[x], face: run.seed + '-' + run.step + '-' + x,
      role: c.role, claim: c.claim, align: c.align, afflict: c.afflict,
      policy: c.policy, want: c.want, stmt: c.stmt,
      flipped: false, executed: false, mark: '',
      seal: null, holy: null, truthShown: false, identity: null, afflictShown: false, crow: null,
      tenbin: false,
    }));
    const t = {
      R: spec.R, C: spec.C, n: spec.R * spec.C, k: spec.k, u: res.w.u, m: spec.m, lurk: res.w.lurk || 0,
      misPlus: CHAPTERS[run.chapter].misPlus || 0,
      boss: spec.boss, chapter: run.chapter, idx: run.trialIdx, amb: res.amb,
      cards, order: [], evilDown: 0, mis: 0, done: false, failed: false,
      pardon: false, hotenUsed: false, bossRow: null, events: [],
    };
    run.trial = t;
    run.phase = 'trial';
    const r2 = rng('relicstart');
    if (has('tenbin')) r2.pick(cards).tenbin = true;
    if (has('gantai')) { const c = r2.pick(cards.filter((x) => x.align === 'good' && !x.afflict)); if (c) c.seal = 'white'; }
    if (has('shokan')) { const c = r2.pick(cards.filter((x) => x.align === 'med' || x.afflict)); if (c) c.seal = 'unr'; }
    if (has('kiba') && spec.boss) { const b = cards.find((x) => x.role === spec.boss); t.bossRow = Math.floor(b.i / spec.C); }
    if (has('seihai') && r2.chance(0.33)) addItem('holywater');
    saveRun();
  }

  /* ----- 審判中の行動 ----- */
  function flip(i) {
    const t = run.trial;
    const c = t.cards[i];
    if (c.flipped || t.done) return null;
    c.flipped = true;
    t.order.push(i);
    run.stats.flips++;
    if (!c.stmt) c.stmt = lazyStatement(t, i, rng('lazy' + i + ':' + t.order.length));
    if (c.tenbin) c.truthShown = true;
    if (has('kanenoshita') && t.order.length === 1) c.truthShown = true;
    if (has('hakkotsu') && c.afflict) c.afflictShown = true;
    saveRun();
    return c;
  }

  function setMark(i, m) {
    const c = run.trial.cards[i];
    c.mark = c.mark === m ? '' : m;
    saveRun();
  }

  function agitatorAlive(t) {
    return t.cards.some((c) => c.role === 'agitator' && !c.executed);
  }

  function execute(i) {
    const t = run.trial;
    const c = t.cards[i];
    if (c.executed || t.done) return null;
    c.executed = true;
    const out = { card: c, evil: c.align === 'evil', penalty: 0, saved: null, silver: 0 };
    if (has('karasu')) {
      const g = geo(t.R, t.C);
      out.crow = g.adj8[i].filter((j) => t.cards[j].align === 'evil').length;
      c.crow = out.crow;
    }
    if (out.evil) {
      t.evilDown++;
      run.stats.evil++;
      meta.evilCaught++;
      if (has('yubiwa')) { run.silver += 4; out.silver += 4; }
      if (t.evilDown >= t.k) winTrial(out);
    } else {
      let p = c.align === 'med' ? (ROLE[c.role].execCost || 1) : 2;
      if (agitatorAlive(t)) p += 1;
      if (run.rank >= 5) p += 1;
      p += t.misPlus || 0;
      if (has('hoten') && !t.hotenUsed) { p = Math.max(0, p - 1); t.hotenUsed = true; }
      if (t.pardon) { p = 0; t.pardon = false; out.saved = 'pardon'; }
      else if (has('kuroneko') && rng('neko' + t.mis + ':' + i).chance(0.5)) { p = 0; out.saved = 'kuroneko'; }
      out.penalty = p;
      run.cred -= p;
      t.mis++;
      run.stats.mis++;
      meta.misExec++;
      if (run.cred <= 0) {
        run.cred = 0;
        t.failed = true;
        loseRun();
        out.gameover = true;
      }
    }
    saveRun(); saveMeta();
    return out;
  }

  function winTrial(out) {
    const t = run.trial;
    t.done = true;
    const before = unlockSnapshot();
    const gain = 12 + t.k * 3 + (t.mis === 0 ? 10 : 0);
    run.silver += gain;
    out.win = { silver: gain, perfect: t.mis === 0, healed: 0 };
    if (t.mis === 0 && has('kitosho') && run.cred < run.maxCred) { run.cred++; out.win.healed = 1; }
    run.stats.trials++;
    meta.trialsCleared++;
    const ch = CHAPTERS[run.chapter];
    const lastOfChapter = run.trialIdx === ch.trials.length - 1;
    if (lastOfChapter) {
      if (run.chapter === 0) meta.flags.ch1 = true;
      if (run.chapter === 1) meta.flags.ch2 = true;
      if (run.chapter === 2) meta.flags.ch3 = true;
      if (ch.final) meta.flags.win = true;
      if (ch.extra && !ch.finalExtra) meta.flags.abyss1 = true;
      if (ch.finalExtra) meta.flags.abyss2 = true;
      meta.bestChapter = Math.max(meta.bestChapter, run.chapter);
    }
    out.unlocks = checkUnlocks(before);
    meta.newUnlocks = (meta.newUnlocks || []).concat(out.unlocks);
    if (ch.final && lastOfChapter && !run.extended) {
      meta.wins++;
      meta.maxRank = Math.max(meta.maxRank, Math.min(RANKS.length - 1, run.rank + 1));
      run.phase = 'victory';
    } else if (ch.finalExtra && lastOfChapter) {
      run.phase = 'victory2';
    } else {
      run.phase = 'reward';
      run.reward = makeReward(!!ch.trials[run.trialIdx].boss);
    }
  }

  function loseRun() {
    run.phase = 'gameover';
    meta.bestChapter = Math.max(meta.bestChapter, run.chapter - 1);
  }

  /* ----- 道具 ----- */
  function addItem(id) {
    if (run.items.length >= slotCount()) return false;
    run.items.push(id);
    return true;
  }
  const slotCount = () => run.slots + (has('gaito') ? 1 : 0);

  function useItem(slot, target) {
    const t = run.trial;
    const id = run.items[slot];
    if (!id || t.done) return null;
    const it = ITEM[id];
    const res = { id };
    if (it.target !== 'none') {
      const c = t.cards[target];
      if (!c) return null;
      if (it.target === 'flipped' && !c.flipped) return { error: '尋問済みの者にしか使えない。' };
      res.card = c;
      if (id === 'holywater') {
        const fakesGood = ['spy', 'masked', 'lord', 'hollow', 'thousand'].includes(c.role);
        c.holy = c.align === 'evil' && !fakesGood ? 'evil' : 'good';
        res.result = c.holy;
      } else if (id === 'scales') {
        c.truthShown = true;
        res.result = statementTruth(t, c.i);
      } else if (id === 'candle') {
        const fooled = c.role === 'masked' || c.role === 'hollow';
        c.identity = fooled ? c.claim : c.role;
        if (c.afflict) c.afflictShown = true;
        res.result = c.identity;
      }
    } else {
      if (id === 'pardon') { if (t.pardon) return { error: '赦免状はすでに効いている。' }; t.pardon = true; }
      if (id === 'wine') { if (run.cred >= run.maxCred) return { error: '信用はすでに満ちている。' }; run.cred = Math.min(run.maxCred, run.cred + 2); }
      if (id === 'lily') {
        const c = rng('lily' + t.order.length + ':' + run.items.length).pick(t.cards.filter((x) => x.align === 'good' && !x.afflict && x.seal !== 'white' && !x.executed));
        if (!c) return { error: '示すべき無辜はもういない。' };
        c.seal = 'white';
        res.card = c;
      }
    }
    run.items.splice(slot, 1);
    saveRun();
    return res;
  }

  /* ----- 報酬・行商・幕間 ----- */
  function relicPool() {
    return RELICS.filter((rl) => relicUnlocked(rl) && !run.relics.includes(rl.id)).map((r) => r.id);
  }
  function makeReward(boss) {
    const r = rng('reward');
    let count = 3 + (has('sakazuki') ? 1 : 0) - (run.rank >= 3 ? 1 : 0);
    const opts = [];
    if (boss) {
      r.sample(relicPool(), count).forEach((id) => opts.push({ type: 'relic', id }));
    } else {
      const bag = [];
      const rp = relicPool();
      if (rp.length && r.chance(0.55)) bag.push({ type: 'relic', id: r.pick(rp) });
      const its = r.sample(ITEMS.map((x) => x.id), 2);
      its.forEach((id) => bag.push({ type: 'item', id }));
      bag.push({ type: 'rest', amount: 2 });
      bag.push({ type: 'silver', amount: 22 });
      r.shuffle(bag).slice(0, count).forEach((o) => opts.push(o));
    }
    if (!opts.length) opts.push({ type: 'silver', amount: 30 });
    return { options: opts, taken: false };
  }

  function takeReward(idx) {
    const o = run.reward.options[idx];
    if (!o || run.reward.taken) return null;
    const res = applyGain(o);
    if (res && res.error) return res;
    run.reward.taken = true;
    advance();
    return res;
  }
  function skipReward() { run.reward.taken = true; advance(); }

  function applyGain(o) {
    if (o.type === 'relic') {
      run.relics.push(o.id);
      if (o.id === 'seiyaku') { run.maxCred += 2; run.cred += 2; }
    } else if (o.type === 'item') {
      if (!addItem(o.id)) return { error: '道具がいっぱいだ。' };
    } else if (o.type === 'rest') {
      run.cred = Math.min(run.maxCred, run.cred + o.amount);
    } else if (o.type === 'silver') {
      run.silver += o.amount;
    }
    saveRun();
    return { ok: true };
  }

  function advance() {
    const ch = CHAPTERS[run.chapter];
    run.step++;
    if (run.trialIdx < ch.trials.length - 1) {
      run.trialIdx++;
      startTrial();
    } else {
      run.phase = 'interlude';
      run.shop = makeShop();
    }
    saveRun();
  }

  const price = (p) => Math.round(p * (has('kagi') ? 0.7 : 1));
  function makeShop() {
    const r = rng('shop');
    const goods = r.sample(ITEMS.map((x) => x.id), 3).map((id) => ({ type: 'item', id, price: price(ITEM[id].price), sold: false }));
    const rp = relicPool();
    if (rp.length) goods.push({ type: 'relic', id: r.pick(rp), price: price(48), sold: false });
    goods.push({ type: 'rest', amount: 2, price: price(20), sold: false });
    return { goods, rested: false };
  }
  function buy(idx) {
    const g = run.shop.goods[idx];
    if (!g || g.sold) return null;
    if (run.silver < g.price) return { error: '銀貨が足りない。' };
    if (g.type === 'rest' && run.cred >= run.maxCred) return { error: '信用はすでに満ちている。' };
    const res = applyGain(g);
    if (res.error) return res;
    run.silver -= g.price;
    g.sold = true;
    saveRun();
    return { ok: true };
  }
  function rest() {
    if (run.shop.rested) return null;
    const amt = run.rank >= 5 ? 1 : 2;
    run.cred = Math.min(run.maxCred, run.cred + amt);
    run.shop.rested = true;
    saveRun();
    return { amount: amt };
  }
  function nextChapter() {
    run.chapter++;
    run.trialIdx = 0;
    run.step++;
    run.shop = null;
    startTrial();
    saveRun();
  }

  function abandon() { run = null; saveRun(); }

  /* ----- 外典（勝利後の続き） ----- */
  const firstExtra = () => CHAPTERS.findIndex((c) => c.extra);
  function continueExtra() {
    run.extended = true;
    run.chapter = firstExtra();
    run.trialIdx = 0;
    run.step++;
    run.cred = Math.min(run.maxCred, run.cred + 2);
    meta.flags.abyss = true;
    saveMeta();
    startTrial();
    saveRun();
  }
  function newExtraRun(rank) {
    newRun(rank);
    const r = new RNG(run.seed + ':extra-start');
    run.relics = r.sample(RELICS.filter((x) => relicUnlocked(x) && x.id !== 'seiyaku').map((x) => x.id), 2);
    run.items = ['holywater', 'scales'];
    run.silver = 40;
    run.extended = true;
    run.direct = true;
    run.chapter = firstExtra();
    run.step++;
    meta.flags.abyss = true;
    saveMeta();
    startTrial();
    saveRun();
  }

  /* ----- 手ほどき（固定盤面） ----- */
  function tutorialTrial() {
    const def = [
      { role: 'watch', align: 'good', stmt: { text: '私の上下左右に、虚偽者は0人いる。', pred: { t: 'cnt', s: [1, 3], v: 0 }, refs: [1, 3] } },
      { role: 'seer', align: 'good', stmt: { text: '⟦5⟧は虚偽者ではない。', pred: { t: 'ev', j: 5, b: false }, refs: [5] } },
      { role: 'perjurer', claim: 'accuser', align: 'evil', stmt: { text: '⟦0⟧は虚偽者だ！', pred: { t: 'ev', j: 0, b: true }, refs: [0] } },
      { role: 'nun', align: 'good', stmt: { text: '⟦1⟧は善良な者だ。私が保証しよう。', pred: { t: 'ev', j: 1, b: false }, refs: [1] } },
      { role: 'gate', align: 'good', stmt: { text: '私の上下左右に、虚偽者はいない。', pred: { t: 'any', s: [1, 3, 5], b: false }, refs: [1, 3, 5] } },
      { role: 'locksmith', align: 'good', stmt: { text: '⟦0⟧・⟦2⟧・⟦4⟧の中に、虚偽者は1人いる。', pred: { t: 'cnt', s: [0, 2, 4], v: 1 }, refs: [0, 2, 4] } },
    ];
    const names = ['エルマ', 'ヨハン', 'ギーゼラ', 'マティアス', 'リーゼル', 'オスヴァルト'];
    return {
      R: 2, C: 3, n: 6, k: 1, u: 0, m: 0, boss: null, chapter: -1, idx: 0, amb: 1, tutorial: true,
      cards: def.map((d, i) => ({
        i, name: names[i], face: 'tut-' + i, role: d.role, claim: d.claim || d.role, align: d.align, afflict: null,
        policy: d.align === 'evil' ? 'F' : 'T', want: d.align !== 'evil', stmt: d.stmt,
        flipped: false, executed: false, mark: '', seal: null, holy: null, truthShown: false, identity: null,
        afflictShown: false, crow: null, tenbin: false,
      })),
      order: [], evilDown: 0, mis: 0, done: false, failed: false, pardon: false, hotenUsed: false, bossRow: null, events: [],
    };
  }
  function startTutorial() {
    run = {
      v: 1, seed: 1, rank: 0, chapter: 0, trialIdx: 0, cred: BASE_CRED, maxCred: BASE_CRED, silver: 0,
      relics: [], items: [], slots: 3, phase: 'trial', trial: tutorialTrial(), reward: null, shop: null, step: 0,
      stats: { trials: 0, evil: 0, mis: 0, flips: 0 }, log: [], tutorial: true,
    };
    return run;
  }
  // 手ほどき中の処刑（ラン外）
  function tutorialExecute(i) {
    const t = run.trial, c = t.cards[i];
    if (c.executed || t.done) return null;
    c.executed = true;
    const out = { card: c, evil: c.align === 'evil', penalty: 0 };
    if (out.evil) { t.evilDown++; if (t.evilDown >= t.k) { t.done = true; out.win = { silver: 0, perfect: t.mis === 0 }; } }
    else { out.penalty = 2; run.cred = Math.max(0, run.cred - 2); t.mis++; }
    return out;
  }
  function endTutorial() {
    meta.tutorialDone = true;
    saveMeta();
    run = null;
    loadRun();
  }

  return {
    get meta() { return meta; }, get run() { return run; },
    loadMeta, saveMeta, loadRun, saveRun, newRun, flip, setMark, execute, useItem, slotCount,
    takeReward, skipReward, buy, rest, nextChapter, abandon, has, relicUnlocked, roleUnlocked, continueExtra, newExtraRun,
    startTutorial, tutorialExecute, endTutorial, emit, listeners, agitatorAlive,
    clearRunOnly() { run = null; store.del(RUN_KEY); },
    resetAll() { store.del(RUN_KEY); store.del(META_KEY); loadMeta(); run = null; },
  };
})();
