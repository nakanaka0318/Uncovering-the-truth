'use strict';
/* ===== 盤面の論理：幾何・証言生成・真偽判定・ソルバー・審判生成 ===== */

const REF = (j) => '⟦' + j + '⟧';

const geoCache = {};
function geo(R, C) {
  const key = R + 'x' + C;
  if (geoCache[key]) return geoCache[key];
  const n = R * C;
  const pos = range(n).map((i) => ({ r: Math.floor(i / C), c: i % C }));
  const at = (r, c) => (r >= 0 && r < R && c >= 0 && c < C ? r * C + c : -1);
  const adj4 = [], adj8 = [], row = [], col = [];
  for (let i = 0; i < n; i++) {
    const { r, c } = pos[i];
    adj4[i] = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => at(r + dr, c + dc)).filter((x) => x >= 0);
    const a8 = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr || dc) { const x = at(r + dr, c + dc); if (x >= 0) a8.push(x); }
    }
    adj8[i] = a8;
    row[i] = range(C).map((cc) => at(r, cc)).filter((x) => x !== i);
    col[i] = range(R).map((rr) => at(rr, c)).filter((x) => x !== i);
  }
  const dist = (a, b) => Math.abs(pos[a].r - pos[b].r) + Math.abs(pos[a].c - pos[b].c);
  const corners = [at(0, 0), at(0, C - 1), at(R - 1, 0), at(R - 1, C - 1)];
  const even = range(n).filter((i) => (i + 1) % 2 === 0);
  const odd = range(n).filter((i) => (i + 1) % 2 === 1);
  const g = { R, C, n, pos, adj4, adj8, row, col, dist, corners, even, odd };
  geoCache[key] = g;
  return g;
}

const cntIn = (M, s) => { let x = 0; for (const i of s) if (M[i]) x++; return x; };

function hasAdjPair(E, g) {
  for (let i = 0; i < g.n; i++) if (E[i]) for (const j of g.adj4[i]) if (j > i && E[j]) return true;
  return false;
}
function minPairDist(E, g) {
  let best = Infinity;
  for (let i = 0; i < g.n; i++) if (E[i]) for (let j = i + 1; j < g.n; j++) if (E[j]) best = Math.min(best, g.dist(i, j));
  return best;
}
function nearestEvil(E, g, i) {
  let best = Infinity;
  for (let j = 0; j < g.n; j++) if (j !== i && E[j]) best = Math.min(best, g.dist(i, j));
  return best;
}

/* 主張（pred）の真偽を仮説 E（虚偽者）・U（惑い者）で評価 */
function evalPred(p, E, U, g, stmts) {
  switch (p.t) {
    case 'cnt': return cntIn(E, p.s) === p.v;
    case 'any': return (cntIn(E, p.s) > 0) === p.b;
    case 'ev': return !!E[p.j] === p.b;
    case 'one': return (E[p.a] ? 1 : 0) + (E[p.b] ? 1 : 0) === 1;
    case 'same': return (!!E[p.a] === !!E[p.b]) === p.same;
    case 'ucnt': return cntIn(U, p.s) === p.v;
    case 'unr': return !!U[p.j] === p.b;
    case 'pair': return hasAdjPair(E, g) === p.b;
    case 'dist': return nearestEvil(E, g, p.i) === p.v;
    case 'par': {
      let s = 0; for (let i = 0; i < g.n; i++) if (E[i]) s += i + 1;
      return s % 2 === p.v;
    }
    case 'stmt': {
      const st = stmts && stmts[p.j];
      if (!st || st.pred.t === 'stmt') return true;
      return evalPred(st.pred, E, U, g, stmts) === p.b;
    }
    case 'ext': {
      let x = -1;
      if (p.mode === 'min') { for (let i = 0; i < g.n; i++) if (E[i]) { x = i; break; } }
      else { for (let i = g.n - 1; i >= 0; i--) if (E[i]) { x = i; break; } }
      return x === p.j;
    }
    case 'lines': {
      const set = new Set();
      for (let i = 0; i < g.n; i++) if (E[i]) set.add(p.dir === 'row' ? g.pos[i].r : g.pos[i].c);
      return set.size === p.v;
    }
    case 'pd': return minPairDist(E, g) === p.v;
    case 'imp': {
      const cond = !!E[p.a] !== !!p.an;
      const res = !!E[p.b] !== !!p.bn;
      return !cond || res;
    }
    case 'tpar': return cntIn(E, p.s) % 2 === p.v;
    case 'xor': return evalPred(p.p[0], E, U, g, stmts) !== evalPred(p.p[1], E, U, g, stmts);
    case 'none': return true;
    default: return true;
  }
}
const dependsOnU = (p) => p.t === 'ucnt' || p.t === 'unr' || p.t === 'stmt' || (p.t === 'xor' && p.p.some(dependsOnU));

/* ===== 証言の生成 =====
 * gen(ctx, i, want, rng) → { text, pred, refs } | null
 * want: この証言を真にするか偽にするか
 */
function countClaim(ctx, s, want, rng, maxOverride) {
  const v = cntIn(ctx.E, s);
  if (want) return v;
  const max = maxOverride != null ? maxOverride : Math.min(s.length, ctx.k);
  const opts = [];
  for (let x = 0; x <= max; x++) if (x !== v) opts.push(x);
  if (!opts.length) return null;
  // 真値に近い嘘ほど選ばれやすい
  return rng.weighted(opts, (x) => 1 / (1 + Math.abs(x - v)));
}
function cntStmt(ctx, s, want, rng, txt, maxOverride) {
  const v = countClaim(ctx, s, want, rng, maxOverride);
  if (v == null) return null;
  return { text: txt(v), pred: { t: 'cnt', s: s.slice(), v }, refs: s.slice() };
}
const others = (ctx, i) => range(ctx.g.n).filter((x) => x !== i);
function pairs(list) {
  const out = [];
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) out.push([list[a], list[b]]);
  return out;
}
const sortN = (arr) => arr.slice().sort((a, b) => a - b);

const GEN = {
  watch(ctx, i, want, rng) {
    return cntStmt(ctx, ctx.g.adj4[i], want, rng, (v) => `私の上下左右に、虚偽者は${v}人いる。`);
  },
  nightwatch(ctx, i, want, rng) {
    return cntStmt(ctx, ctx.g.adj8[i], want, rng, (v) => `私の周囲八方に、虚偽者は${v}人いる。`);
  },
  seer(ctx, i, want, rng) {
    const j = rng.pick(others(ctx, i));
    const b = want ? !!ctx.E[j] : !ctx.E[j];
    return { text: b ? `${REF(j)}は虚偽者だ。` : `${REF(j)}は虚偽者ではない。`, pred: { t: 'ev', j, b }, refs: [j] };
  },
  balance(ctx, i, want, rng) {
    const ps = pairs(others(ctx, i)).filter(([a, b]) => ((ctx.E[a] ? 1 : 0) + (ctx.E[b] ? 1 : 0) === 1) === want);
    const p = rng.pick(ps);
    if (!p) return null;
    const [a, b] = sortN(p);
    return { text: `${REF(a)}と${REF(b)}のうち、虚偽者はちょうど一人だ。`, pred: { t: 'one', a, b }, refs: [a, b] };
  },
  surveyor(ctx, i, want, rng) {
    return cntStmt(ctx, ctx.g.row[i], want, rng, (v) => `私と同じ横一列には、私を除いて虚偽者が${v}人いる。`);
  },
  mason(ctx, i, want, rng) {
    return cntStmt(ctx, ctx.g.col[i], want, rng, (v) => `私と同じ縦一列には、私を除いて虚偽者が${v}人いる。`);
  },
  nun(ctx, i, want, rng) {
    const j = rng.pick(others(ctx, i).filter((x) => !!ctx.E[x] !== want));
    if (j == null) return null;
    return { text: `${REF(j)}は善良な者だ。私が保証しよう。`, pred: { t: 'ev', j, b: false }, refs: [j] };
  },
  accuser(ctx, i, want, rng) {
    const j = rng.pick(others(ctx, i).filter((x) => !!ctx.E[x] === want));
    if (j == null) return null;
    return { text: `${REF(j)}は虚偽者だ！`, pred: { t: 'ev', j, b: true }, refs: [j] };
  },
  gate(ctx, i, want, rng) {
    const s = ctx.g.adj4[i];
    const truth = cntIn(ctx.E, s) > 0;
    const b = want ? truth : !truth;
    return { text: b ? '私の上下左右に、虚偽者がいる。' : '私の上下左右に、虚偽者はいない。', pred: { t: 'any', s: s.slice(), b }, refs: s.slice() };
  },
  priest(ctx, i, want, rng) {
    const [a, b] = sortN(rng.sample(others(ctx, i), 2));
    const truth = !!ctx.E[a] === !!ctx.E[b];
    const same = want ? truth : !truth;
    return {
      text: same ? `${REF(a)}と${REF(b)}は、同じ陣営に属している。` : `${REF(a)}と${REF(b)}は、異なる陣営に属している。`,
      pred: { t: 'same', a, b, same }, refs: [a, b],
    };
  },
  confessor(ctx, i, want, rng) {
    const ps = pairs(others(ctx, i)).filter(([a, b]) => (!!ctx.E[a] || !!ctx.E[b]) === want);
    const p = rng.pick(ps);
    if (!p) return null;
    const [a, b] = sortN(p);
    return { text: `${REF(a)}か${REF(b)}、少なくともどちらかは虚偽者だ。`, pred: { t: 'any', s: [a, b], b: true }, refs: [a, b] };
  },
  locksmith(ctx, i, want, rng) {
    const s = sortN(rng.sample(others(ctx, i), 3));
    return cntStmt(ctx, s, want, rng, (v) => `${REF(s[0])}・${REF(s[1])}・${REF(s[2])}の中に、虚偽者は${v}人いる。`);
  },
  bell(ctx, i, want, rng) {
    const pre = ctx.prefix || [];
    if (!pre.length) {
      if (want) return { text: '私が最初に呼ばれた。まだ鐘は一つも鳴っていない。', pred: { t: 'cnt', s: [], v: 0 }, refs: [] };
      const v = 1 + rng.int(Math.max(1, Math.min(2, ctx.k)));
      return { text: `私より先に尋問された者の中に、虚偽者は${v}人いる。`, pred: { t: 'cnt', s: [], v }, refs: [] };
    }
    return cntStmt(ctx, pre, want, rng, (v) => `私より先に尋問された${pre.length}人の中に、虚偽者は${v}人いる。`, Math.min(pre.length, ctx.k) || 1);
  },
  hunter(ctx, i, want, rng) {
    const d = nearestEvil(ctx.E, ctx.g, i);
    if (!isFinite(d)) return null;
    let v = d;
    if (!want) {
      let maxD = 0; for (let j = 0; j < ctx.g.n; j++) maxD = Math.max(maxD, ctx.g.dist(i, j));
      const opts = range(maxD).map((x) => x + 1).filter((x) => x !== d);
      if (!opts.length) return null;
      v = rng.weighted(opts, (x) => 1 / (1 + Math.abs(x - d)));
    }
    return { text: `私に最も近い虚偽者は、${v}歩先にいる。`, pred: { t: 'dist', i, v }, refs: [] };
  },
  scribe(ctx, i, want, rng) {
    const even = rng.chance(0.5);
    const s = even ? ctx.g.even : ctx.g.odd;
    return cntStmt(ctx, s, want, rng, (v) => `番号が${even ? '偶数' : '奇数'}の者たちの中に、虚偽者は${v}人いる。`);
  },
  doctor(ctx, i, want, rng) {
    const j = rng.pick(others(ctx, i));
    const truth = !!ctx.U[j];
    const b = want ? truth : !truth;
    return { text: b ? `${REF(j)}は惑い者だ。` : `${REF(j)}は惑い者ではない。`, pred: { t: 'unr', j, b }, refs: [j] };
  },
  grave(ctx, i, want, rng) {
    const j = ctx.prev != null ? ctx.prev : rng.pick(others(ctx, i));
    const b = want ? !!ctx.E[j] : !ctx.E[j];
    const lead = ctx.prev != null ? '直前に尋問された' : 'まだ誰も尋問されていないが……';
    return { text: `${lead}${REF(j)}は、${b ? '虚偽者だ' : '虚偽者ではない'}。`, pred: { t: 'ev', j, b }, refs: [j] };
  },
  bard(ctx, i, want, rng) {
    const truth = hasAdjPair(ctx.E, ctx.g);
    const b = want ? truth : !truth;
    return {
      text: b ? '上下左右に隣り合っている虚偽者どうしがいる。' : '虚偽者どうしは、上下左右に隣り合っていない。',
      pred: { t: 'pair', b }, refs: [],
    };
  },
  herbal(ctx, i, want, rng) {
    const s = ctx.g.adj8[i];
    const v = cntIn(ctx.U, s);
    let c = v;
    if (!want) {
      const opts = range(Math.min(s.length, ctx.u) + 1).filter((x) => x !== v);
      if (!opts.length) return null;
      c = rng.pick(opts);
    }
    return { text: `私の周囲八方に、惑い者は${c}人いる。`, pred: { t: 'ucnt', s: s.slice(), v: c }, refs: s.slice() };
  },
  mirror(ctx, i, want, rng) {
    const cands = others(ctx, i).filter((j) => ctx.stmts[j] && ctx.stmts[j].pred.t !== 'stmt');
    const j = rng.pick(cands);
    if (j == null) return null;
    const truth = evalPred(ctx.stmts[j].pred, ctx.E, ctx.U, ctx.g, ctx.stmts);
    const b = want ? truth : !truth;
    return { text: b ? `${REF(j)}の証言は真実だ。` : `${REF(j)}の証言は偽りだ。`, pred: { t: 'stmt', j, b }, refs: [j] };
  },
  carto(ctx, i, want, rng) {
    const s = [...new Set(ctx.g.corners)];
    return cntStmt(ctx, s, want, rng, (v) => `盤の四隅にいる者たちの中に、虚偽者は${v}人いる。`);
  },
  numer(ctx, i, want, rng) {
    let s = 0; for (let j = 0; j < ctx.g.n; j++) if (ctx.E[j]) s += j + 1;
    const truth = s % 2;
    const v = want ? truth : 1 - truth;
    return { text: `虚偽者全員の番号を足すと、${v ? '奇数' : '偶数'}になる。`, pred: { t: 'par', v }, refs: [] };
  },
  // ----- 複雑な身分 -----
  registrar(ctx, i, want, rng) {
    const mode = rng.chance(0.5) ? 'min' : 'max';
    const evs = range(ctx.g.n).filter((x) => ctx.E[x]);
    if (!evs.length) return null;
    const tj = mode === 'min' ? evs[0] : evs[evs.length - 1];
    let j = tj;
    if (!want) {
      const opts = range(ctx.g.n).filter((x) => x !== tj && x !== i);
      j = rng.weighted(opts, (x) => 1 / (1 + Math.abs(x - tj)));
    }
    return { text: `虚偽者のうち、最も${mode === 'min' ? '若い' : '大きい'}番号は${REF(j)}だ。`, pred: { t: 'ext', mode, j }, refs: [j] };
  },
  astro(ctx, i, want, rng) {
    const dir = rng.chance(0.5) ? 'row' : 'col';
    const lines = dir === 'row' ? ctx.g.R : ctx.g.C;
    const set = new Set();
    for (let x = 0; x < ctx.g.n; x++) if (ctx.E[x]) set.add(dir === 'row' ? ctx.g.pos[x].r : ctx.g.pos[x].c);
    let v = set.size;
    if (!want) {
      const opts = range(Math.min(lines, ctx.k)).map((x) => x + 1).filter((x) => x !== v);
      if (!opts.length) return null;
      v = rng.weighted(opts, (x) => 1 / (1 + Math.abs(x - set.size)));
    }
    return { text: `虚偽者が一人でもいる${dir === 'row' ? '横列' : '縦列'}は、全部で${v}本だ。`, pred: { t: 'lines', dir, v }, refs: [] };
  },
  scout(ctx, i, want, rng) {
    const d = minPairDist(ctx.E, ctx.g);
    if (!isFinite(d)) return null;
    let v = d;
    if (!want) {
      const opts = range(ctx.g.R + ctx.g.C - 2).map((x) => x + 1).filter((x) => x !== d);
      if (!opts.length) return null;
      v = rng.weighted(opts, (x) => 1 / (1 + Math.abs(x - d)));
    }
    return { text: `最も近くにいる虚偽者どうしは、${v}歩離れている。`, pred: { t: 'pd', v }, refs: [] };
  },
  witness(ctx, i, want, rng) {
    const os = others(ctx, i);
    const preferLive = rng.chance(0.75);
    let fallback = null;
    for (let tries = 0; tries < 60; tries++) {
      const [a, b] = rng.sample(os, 2);
      const an = rng.chance(0.35), bn = rng.chance(0.4);
      const cond = !!ctx.E[a] !== an;
      const res = !!ctx.E[b] !== bn;
      const truth = !cond || res;
      if (truth !== want) continue;
      const st = {
        text: `もし${REF(a)}が${an ? '虚偽者でない' : '虚偽者'}なら、${REF(b)}は${bn ? '虚偽者ではない' : '虚偽者だ'}。`,
        pred: { t: 'imp', a, an, b, bn }, refs: [a, b],
      };
      if (!want || !preferLive || cond) return st;
      fallback = fallback || st;
    }
    return fallback;
  },
  heretic(ctx, i, want, rng) {
    const s = sortN(rng.sample(others(ctx, i), 3));
    const truth = cntIn(ctx.E, s) % 2;
    const v = want ? truth : 1 - truth;
    return { text: `${REF(s[0])}・${REF(s[1])}・${REF(s[2])}の中の虚偽者は、${v ? '奇数' : '偶数'}人だ。`, pred: { t: 'tpar', s, v }, refs: s };
  },
  split(ctx, i, want, rng) {
    const kinds = ['seer', 'gate', 'watch', 'accuser', 'nun', 'priest'];
    for (let tries = 0; tries < 12; tries++) {
      const vals = want ? rng.shuffle([true, false]) : (rng.chance(0.25) ? [true, true] : [false, false]);
      const [k1, k2] = rng.sample(kinds, 2);
      const s1 = GEN[k1](ctx, i, vals[0], rng);
      const s2 = GEN[k2](ctx, i, vals[1], rng);
      if (!s1 || !s2) continue;
      return {
        text: `一つ、${s1.text}　二つ、${s2.text}`,
        pred: { t: 'xor', p: [s1.pred, s2.pred] },
        refs: sortN([...new Set([...(s1.refs || []), ...(s2.refs || [])])]),
      };
    }
    return null;
  },
  // ----- 正体を隠さない者たち -----
  jester(ctx, i, want, rng) {
    const s = GEN.seer(ctx, i, want, rng);
    s.text = 'ひひっ、教えてやろうか。' + s.text;
    return s;
  },
  zealot(ctx, i, want, rng) {
    const j = rng.pick(others(ctx, i).filter((x) => !!ctx.E[x] === want));
    if (j == null) return null;
    return { text: `火刑だ！ ${REF(j)}こそ虚偽者だ！`, pred: { t: 'ev', j, b: true }, refs: [j] };
  },
  poisoner(ctx, i, want, rng) {
    let pool = ctx.g.adj8[i].filter((x) => !ctx.E[x] && !!ctx.U[x] === want);
    if (!pool.length) pool = others(ctx, i).filter((x) => !ctx.E[x] && !!ctx.U[x] === want);
    const j = rng.pick(pool);
    if (j == null) return null;
    return { text: `ふふ……${REF(j)}の杯に、毒を垂らしておいたわ。`, pred: { t: 'unr', j, b: true }, refs: [j] };
  },
  agitator(ctx, i, want, rng) {
    const j = rng.pick(others(ctx, i).filter((x) => !!ctx.E[x] === want));
    if (j == null) return null;
    return { text: `皆の者、聞け！ ${REF(j)}は虚偽者だ！ 吊るせ！`, pred: { t: 'ev', j, b: true }, refs: [j] };
  },
};

/* ===== ソルバー：公開情報と矛盾しない「虚偽者の組」を数える ===== */
function forCombos(pool, k, fn) {
  const n = pool.length;
  if (k > n) return;
  const idx = range(k);
  if (k === 0) { fn([]); return; }
  while (true) {
    if (fn(idx.map((x) => pool[x])) === false) return;
    let p = k - 1;
    while (p >= 0 && idx[p] === n - k + p) p--;
    if (p < 0) return;
    idx[p]++;
    for (let q = p + 1; q < k; q++) idx[q] = idx[q - 1] + 1;
  }
}

/*
 * info: { n, R, C, k, u, claims[], openEvil[], openMed[], stmts[], knownEvil[], knownGood[] }
 * 戻り値: 矛盾しない虚偽者集合（配列）のリスト（limit まで）
 */
function solve(info, limit = 6) {
  const g = geo(info.R, info.C);
  const n = g.n;
  const sols = [];
  const mustE = new Set([...(info.openEvil || []), ...(info.knownEvil || [])]);
  const notE = new Set([...(info.openMed || []), ...(info.knownGood || [])]);
  const openEvil = new Set(info.openEvil || []);
  const pool = range(n).filter((i) => !mustE.has(i) && !notE.has(i));
  const need = info.k - mustE.size;
  if (need < 0) return sols;
  const lk = info.lurk || 0;
  const E = new Uint8Array(n);
  const U = new Uint8Array(n);
  const L = new Uint8Array(n);
  const stmts = info.stmts;

  // E と潜伏者 L を固定したとき、惑い者 U の置き方が存在するか
  function consistent() {
    const forced = new Set(info.openMed || []);
    const deferred = [];
    for (let i = 0; i < n; i++) {
      const st = stmts[i];
      if (!st) continue;
      if (dependsOnU(st.pred)) { deferred.push(i); continue; }
      const v = evalPred(st.pred, E, null, g, stmts);
      if (E[i]) { if (v !== !!L[i]) return false; } else if (!v) forced.add(i);
    }
    if (forced.size > info.u) return false;
    for (const i of forced) if (E[i]) return false;
    const upool = range(n).filter((i) => !E[i] && !forced.has(i));
    const uneed = info.u - forced.size;
    if (upool.length < uneed) return false;
    if (!deferred.length) return true;
    let ok = false;
    forCombos(upool, uneed, (uc) => {
      U.fill(0);
      for (const i of forced) U[i] = 1;
      for (const i of uc) U[i] = 1;
      for (const i of deferred) {
        if (U[i]) continue;
        const v = evalPred(stmts[i].pred, E, U, g, stmts);
        if (E[i] ? v !== !!L[i] : !v) return true;
      }
      ok = true;
      return false;
    });
    return ok;
  }

  forCombos(pool, need, (combo) => {
    E.fill(0);
    for (const i of mustE) E[i] = 1;
    for (const i of combo) E[i] = 1;
    // 善側の身分は重複しない
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      if (E[i]) continue;
      const c = info.claims[i];
      if (c == null) continue;
      if (seen.has(c)) return true;
      seen.add(c);
    }
    let ok = false;
    const lpool = range(n).filter((i) => E[i] && !openEvil.has(i));
    forCombos(lpool, lk, (ls) => {
      L.fill(0);
      for (const i of ls) L[i] = 1;
      if (consistent()) { ok = true; return false; }
      return true;
    });
    if (ok) {
      sols.push(range(n).filter((i) => E[i]));
      if (sols.length >= limit) return false;
    }
    return true;
  });
  return sols;
}

function solverInfoFromTrial(t, opts = {}) {
  return {
    R: t.R, C: t.C, n: t.n, k: t.k, u: t.u, lurk: t.lurk || 0,
    claims: t.cards.map((c) => c.claim),
    openEvil: t.cards.filter((c) => ROLE[c.claim].open && (ROLE[c.claim].align === 'minion' || ROLE[c.claim].align === 'boss')).map((c) => c.i),
    openMed: t.cards.filter((c) => ROLE[c.claim].open && ROLE[c.claim].align === 'med').map((c) => c.i),
    stmts: t.cards.map((c) => (opts.onlyFlipped && !c.flipped ? null : c.stmt)),
    knownEvil: opts.knownEvil || [],
    knownGood: opts.knownGood || [],
  };
}

/* ===== 審判の生成 ===== */
function truthOf(cards, n) {
  const E = new Uint8Array(n), U = new Uint8Array(n);
  for (const c of cards) {
    if (c.align === 'evil') E[c.i] = 1;
    if (c.align === 'med' || c.afflict) U[c.i] = 1;
  }
  return { E, U };
}

const policyOf = (c) => {
  if (c.role === 'lurker') return 'T';
  if (c.align === 'evil') return 'F';
  if (c.afflict === 'charm') return 'F';
  if (c.afflict === 'poison') return 'R';
  if (c.align === 'med') return ROLE[c.role].policy || 'R';
  return 'T';
};

function buildWorld(spec, pools, rng) {
  const { R, C } = spec;
  const g = geo(R, C);
  const n = g.n;
  const k = spec.k;
  const slots = rng.shuffle(range(n));
  const cards = range(n).map((i) => ({ i, role: null, claim: null, align: 'good', afflict: null }));

  // 虚偽者
  const evilIdx = slots.slice(0, k);
  const evilRoles = [];
  if (spec.boss) evilRoles.push(spec.boss);
  let openUsed = false;
  while (evilRoles.length < k) {
    let r = rng.pick(pools.minion);
    if (ROLE[r].open) {
      if (openUsed || rng.chance(0.45)) r = 'perjurer';
      else openUsed = true;
    }
    if (r === 'mimic' && evilRoles.includes('mimic')) r = 'perjurer';
    if (r === 'lurker' && (spec.chapter < 2 || evilRoles.includes('lurker') || k - (spec.boss ? 1 : 0) < 2)) r = 'perjurer';
    evilRoles.push(r);
  }
  // 潜伏者の人数を整える
  const wantLurk = Math.max(spec.lurk || 0, spec.boss === 'thousand' ? 1 : 0);
  for (let x = 0; x < evilRoles.length && evilRoles.filter((r) => r === 'lurker').length < wantLurk; x++) {
    const r = evilRoles[x];
    if (r !== spec.boss && !ROLE[r].open && r !== 'lurker') evilRoles[x] = 'lurker';
  }
  evilIdx.forEach((ci, x) => { cards[ci].role = evilRoles[x]; cards[ci].align = 'evil'; });

  // 惑い者
  const medIdx = slots.slice(k, k + spec.m);
  let openMed = false;
  for (const ci of medIdx) {
    let r = rng.pick(pools.med);
    if (ROLE[r].open) { if (openMed) r = 'drunk'; else openMed = true; }
    cards[ci].role = r; cards[ci].align = 'med';
  }

  // 無辜
  const goodIdx = slots.slice(k + spec.m);
  const uTotalGuess = spec.m + spec.afflictCount;
  let goodPool = pools.good.filter((r) => uTotalGuess > 0 || (r !== 'doctor' && r !== 'herbal'));
  if (k < 2) goodPool = goodPool.filter((r) => r !== 'bard' && r !== 'scout');
  let goodRoles;
  if (spec.complex) {
    const cx = rng.sample(goodPool.filter((r) => ROLE[r].complex), Math.min(4, goodIdx.length));
    goodRoles = rng.shuffle(cx.concat(rng.sample(goodPool.filter((r) => !cx.includes(r)), goodIdx.length - cx.length)));
  } else goodRoles = rng.sample(goodPool, goodIdx.length);
  if (goodRoles.length < goodIdx.length) return null;
  goodIdx.forEach((ci, x) => { cards[ci].role = goodRoles[x]; });

  // 毒・魅了
  const goods = () => cards.filter((c) => c.align === 'good' && !c.afflict);
  for (const c of cards.filter((x) => x.align === 'evil')) {
    if (c.role === 'poisoner' || c.role === 'wolfking') {
      const t = rng.pick(g.adj8[c.i].map((j) => cards[j]).filter((x) => x.align === 'good' && !x.afflict));
      if (!t) return null;
      t.afflict = c.role === 'poisoner' ? 'poison' : 'charm';
    } else if (c.role === 'bishop') {
      for (let z = 0; z < 2; z++) { const t = rng.pick(goods()); if (!t) return null; t.afflict = 'poison'; }
    } else if (c.role === 'hollow') {
      const a = rng.pick(goods()); if (!a) return null; a.afflict = 'poison';
      const b = rng.pick(goods()); if (!b) return null; b.afflict = 'charm';
    } else if (c.role === 'thousand') {
      const t = rng.pick(goods()); if (!t) return null; t.afflict = 'poison';
    } else if (c.role === 'lord') {
      const a = rng.pick(goods()); if (!a) return null; a.afflict = 'poison';
      const b = rng.pick(goods()); if (!b) return null; b.afflict = 'charm';
    }
  }

  // 名乗る身分
  const goodClaims = new Set(cards.filter((c) => c.align === 'good').map((c) => c.role));
  const unusedGood = pools.good.filter((r) => !goodClaims.has(r) && (uTotalGuess > 0 || (r !== 'doctor' && r !== 'herbal')));
  const takenFake = new Set();
  for (const c of cards) {
    const ro = ROLE[c.role];
    if (c.align === 'good' || ro.open) { c.claim = c.role; continue; }
    if (c.role === 'mimic') { c.claim = rng.pick([...goodClaims]); continue; }
    let pool2 = unusedGood.filter((r) => !takenFake.has(r));
    if (!pool2.length) pool2 = unusedGood;
    if (!pool2.length) return null;
    c.claim = rng.pick(pool2);
    takenFake.add(c.claim);
  }

  const truth = truthOf(cards, n);
  const u = cntIn(truth.U, range(n));
  const ctx = { g, E: truth.E, U: truth.U, k, u, stmts: new Array(n).fill(null) };

  // 証言（鐘撞き・墓守は尋問時に生成。鏡職人は最後）
  const order = rng.shuffle(range(n)).sort((a, b) => (cards[a].claim === 'mirror') - (cards[b].claim === 'mirror'));
  for (const i of order) {
    const c = cards[i];
    c.policy = policyOf(c);
    c.want = c.policy === 'T' ? true : c.policy === 'F' ? false : rng.chance(0.5);
    if (ROLE[c.claim].lazy) { c.stmt = null; continue; }
    let st = GEN[c.claim](ctx, i, c.want, rng);
    if (!st && c.policy === 'R') { c.want = !c.want; st = GEN[c.claim](ctx, i, c.want, rng); }
    if (!st && c.claim !== c.role && c.role !== 'mimic') {
      // 騙る身分を変えて再挑戦
      for (let tries = 0; tries < 6 && !st; tries++) {
        const alt = rng.pick(unusedGood.filter((r) => !ROLE[r].lazy && r !== 'mirror' && !takenFake.has(r)));
        if (!alt) break;
        st = GEN[alt](ctx, i, c.want, rng);
        if (st) { c.claim = alt; takenFake.add(alt); }
      }
    }
    if (!st) return null;
    c.stmt = st;
    ctx.stmts[i] = st;
  }
  const lurk = cards.filter((c) => c.role === 'lurker').length;
  return { cards, u, truth, lurk };
}

/*
 * spec: { R, C, k, m, boss, afflictCount, maxAmb, chapter }
 * pools: { good:[], med:[], minion:[] }
 */
function generateTrial(spec, pools, seed) {
  const rng = new RNG(seed);
  let best = null;
  for (let attempt = 0; attempt < 90; attempt++) {
    const w = buildWorld(spec, pools, rng);
    if (!w) continue;
    const t = { R: spec.R, C: spec.C, n: spec.R * spec.C, k: spec.k, u: w.u, lurk: w.lurk, cards: w.cards };
    const sols = solve(solverInfoFromTrial(t), 8);
    const amb = sols.length;
    if (amb === 0) continue; // 生成の不具合（安全策）
    const score = amb;
    if (!best || score < best.score) best = { score, w, amb };
    if (amb <= spec.maxAmb) break;
  }
  return best;
}

/* 尋問時に遅延証言（鐘撞き・墓守）を生成 */
function lazyStatement(trial, i, rng) {
  const g = geo(trial.R, trial.C);
  const truth = truthOf(trial.cards, trial.n);
  const prefix = trial.order.filter((x) => x !== i);
  const ctx = {
    g, E: truth.E, U: truth.U, k: trial.k, u: trial.u,
    stmts: trial.cards.map((c) => c.stmt), prefix: prefix.slice(),
    prev: prefix.length ? prefix[prefix.length - 1] : null,
  };
  const c = trial.cards[i];
  let st = GEN[c.claim](ctx, i, c.want, rng);
  if (!st) st = GEN[c.claim](ctx, i, !c.want, rng);
  return st;
}

function statementTruth(trial, i) {
  const c = trial.cards[i];
  if (!c.stmt) return null;
  const truth = truthOf(trial.cards, trial.n);
  return evalPred(c.stmt.pred, truth.E, truth.U, geo(trial.R, trial.C), trial.cards.map((x) => x.stmt));
}
