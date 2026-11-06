'use strict';
/* ===== 画面描画と操作 ===== */

const EMBLEM = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
<circle cx="50" cy="50" r="46" opacity=".45"/><circle cx="50" cy="50" r="40" stroke-dasharray="1.5 4.5" opacity=".7"/>
<circle cx="50" cy="16" r="3.5"/><path d="M50 20 V28 M39 30 H61 M50 30 V82 L46.5 76 V34 M50 82 L53.5 76 V34"/>
<path d="M22 42 H78" /><path d="M22 42 L15 60 M22 42 L29 60 M78 42 L71 60 M78 42 L85 60"/>
<path d="M13 60 Q22 69 31 60 Z M69 60 Q78 69 87 60 Z" fill="currentColor" fill-opacity=".25"/>
</svg>`;

const UI = (() => {
  const app = document.getElementById('app');
  let toastWrap;
  let view = null;           // 現在の画面
  let sel = null;            // 選択中の札
  let targetSlot = null;     // 対象選択中の道具
  let typer = null;          // 文字送り
  let tut = null;            // 手ほどきの状態
  let ro = null;
  let busy = false;

  const run = () => Game.run;
  const T = () => Game.run && Game.run.trial;
  const SPEEDS = [22, 45, 95, 0];

  /* ---------- 小道具 ---------- */
  function rich(text) {
    return esc(text).replace(/⟦(\d+)⟧/g, (_, j) => `<span class="ref" role="button" tabindex="0" data-act="ref" data-ref="${j}">${circ(+j)}</span>`);
  }
  const plain = (text) => text.replace(/⟦(\d+)⟧/g, (_, j) => circ(+j));

  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = msg;
    toastWrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2600);
  }

  function modal({ title, body, buttons = [], onClose, cls = '', closable = true }) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title || '')}">
      ${closable ? '<button class="modal-x" aria-label="閉じる" data-x>×</button>' : ''}
      ${title ? `<div class="modal-h">${title}</div>` : ''}
      <div class="modal-b">${body || ''}</div>
      ${buttons.length ? `<div class="modal-f">${buttons.map((b, i) => `<button class="btn small ${b.cls || ''}" data-mb="${i}">${b.label}</button>`).join('')}</div>` : ''}
    </div>`;
    const close = () => { bg.remove(); if (onClose) onClose(); };
    bg.addEventListener('click', (e) => {
      if (e.target === bg && closable) { Audio2.play('select'); close(); return; }
      if (e.target.closest('[data-x]')) { Audio2.play('select'); close(); return; }
      const b = e.target.closest('[data-mb]');
      if (b) {
        Audio2.play('select');
        const spec = buttons[+b.dataset.mb];
        const keep = spec.onClick && spec.onClick(bg) === false;
        if (!keep) close();
      }
    });
    app.appendChild(bg);
    const f = bg.querySelector('[data-mb]') || bg.querySelector('[data-x]');
    if (f) f.focus({ preventScroll: true });
    return { el: bg, close };
  }
  const confirmBox = (title, text, okLabel, onOk, danger) => modal({
    title, body: `<p>${text}</p>`,
    buttons: [{ label: 'やめる', cls: 'ghost' }, { label: okLabel, cls: danger ? 'danger' : 'primary', onClick: onOk }],
  });

  function candlesHTML(cur, max, snuffFrom) {
    let s = '';
    for (let i = 0; i < max; i++) {
      const lit = i < cur;
      const snuff = snuffFrom != null && i >= cur && i < snuffFrom;
      s += `<span class="candle ${lit ? '' : snuff ? 'snuff' : 'out'}"><i class="fl"></i></span>`;
    }
    return s;
  }

  function setScreen(html, cls) {
    if (ro) { ro.disconnect(); ro = null; }
    stopTyping();
    app.querySelectorAll('.scr, .overlay, .modal-bg, .guide-box').forEach((n) => n.remove());
    const el = document.createElement('div');
    el.className = 'scr ' + cls;
    el.innerHTML = html;
    app.insertBefore(el, toastWrap);
    return el;
  }

  /* ---------- ルーティング ---------- */
  function route() {
    const r = run();
    if (!r) return showTitle();
    if (r.phase === 'trial' || r.phase === 'gameover') return showTrial(true);
    if (r.phase === 'reward') return showReward();
    if (r.phase === 'interlude') return showInterlude();
    if (r.phase === 'victory') return showVictory();
    if (r.phase === 'victory2') return showVictory2();
    showTitle();
  }

  /* ========== タイトル ========== */
  function showTitle() {
    view = 'title';
    Audio2.setMood('title');
    const m = Game.meta;
    const r = run();
    const canContinue = r && !r.tutorial && (r.phase === 'trial' || r.phase === 'reward' || r.phase === 'interlude');
    const newCount = (m.newUnlocks || []).length;
    setScreen(`
      <div class="title-inner">
        <div class="candles-deco" aria-hidden="true">
          <span class="candle" style="height:30px"><i class="fl"></i></span>
          ${EMBLEM.replace('<svg ', '<svg class="crest" ')}
          <span class="candle" style="height:38px"><i class="fl"></i></span>
        </div>
        <h1>偽りの廷</h1>
        <div class="ruby">いつわりのてい</div>
        <div class="sub">Uncovering the Truth</div>
        <nav class="menu">
          ${canContinue ? `<button class="btn primary" data-act="continue">続きから<small style="font-size:11px;letter-spacing:.05em;color:var(--ash)">　${esc(CHAPTERS[r.chapter].no)}・信用${r.cred}</small></button>` : ''}
          <button class="btn ${canContinue ? '' : 'primary'}" data-act="new">新たな審問</button>
          ${m.flags.win ? '<button class="btn" data-act="new-extra">外典に挑む<small style="font-size:11px;letter-spacing:.05em;color:#ef9aa6">　超むず・激ムズ</small></button>' : ''}
          <button class="btn" data-act="tutorial">手ほどき${m.tutorialDone ? '' : '<span class="badge-new">初めての方へ</span>'}</button>
          <div class="menu-row">
            <button class="btn" data-act="codex">身分図鑑${newCount ? '<span class="badge-new">新</span>' : ''}</button>
            <button class="btn" data-act="relics">聖遺物録</button>
            <button class="btn" data-act="records">記録</button>
            <button class="btn" data-act="settings">設定</button>
          </div>
        </nav>
        <div class="title-foot">累計審判 ${m.trialsCleared}　／　勝利 ${m.wins}　／　到達階位 ${esc(RANKS[m.maxRank].name)}</div>
      </div>`, 'title');
  }

  function startNewFlow() {
    const m = Game.meta;
    const r = run();
    const go = () => {
      if (m.maxRank > 0) return rankSelect();
      beginRun(0);
    };
    const proceed = () => {
      if (!m.tutorialDone) {
        modal({
          title: '初めての審問官へ',
          body: '<p>この廷の掟を、まず小さな審判で学べます。三分ほどで終わります。</p>',
          buttons: [{ label: 'すぐに始める', cls: 'ghost', onClick: () => { Game.meta.tutorialDone = true; Game.saveMeta(); setTimeout(go, 0); } },
            { label: '手ほどきを受ける', cls: 'primary', onClick: () => setTimeout(startTutorial, 0) }],
        });
      } else go();
    };
    if (r && !r.tutorial && (r.phase === 'trial' || r.phase === 'reward' || r.phase === 'interlude')) {
      confirmBox('新たな審問', '進行中の審問は破棄されます。よろしいですか。', '破棄して始める', () => { setTimeout(proceed, 0); }, true);
    } else proceed();
  }

  function rankSelect() {
    const m = Game.meta;
    const body = `<div class="rank-list">${RANKS.map((rk, i) => `
      <button class="rank-opt" data-rank="${i}" ${i > m.maxRank ? 'disabled' : ''}>
        <span class="rn">${['0', 'I', 'II', 'III', 'IV', 'V'][i]}</span><b>${esc(rk.name)}</b>
        <span>${i === 0 ? rk.desc : '以下を累積：' + RANKS.slice(1, i + 1).map((x) => x.desc).join(' ')}${i > m.maxRank ? '（一つ下の階位で勝利すると解禁）' : ''}</span>
      </button>`).join('')}</div>`;
    const md = modal({ title: '階位を選ぶ', body });
    md.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rank]');
      if (b && !b.disabled) { md.close(); beginRun(+b.dataset.rank); }
    });
  }

  function beginRun(rank) {
    Game.newRun(rank);
    showTrial(false, true);
  }

  /* ========== 審判 ========== */
  function showTrial(resume, fresh) {
    view = 'trial';
    sel = null; targetSlot = null;
    const r = run(), t = T();
    const ch = t.tutorial ? { no: '手ほどき', name: '霧の村の小さな審判' } : CHAPTERS[t.chapter];
    Audio2.setMood(t.boss ? 'boss' : 'trial');
    const trialLabel = t.tutorial ? '練習の審判' : (CHAPTERS[t.chapter].final ? '最終審判' : `第${KANJI_NUM[t.idx + 1]}審`);
    const el = setScreen(`
      <header class="hud">
        <button class="hud-menu" data-act="menu" aria-label="メニュー">☰</button>
        <div class="hud-where"><b>${esc(ch.no)}　${esc(ch.name)}</b><span>${trialLabel}${t.boss ? `　<span class="boss-tag">首魁の審判</span>` : ''}</span></div>
        <div class="cred" id="cred" aria-label="信用"></div>
        <div class="silver" id="silver"></div>
      </header>
      <div class="countbar" id="countbar"></div>
      <main class="stage">
        <section class="board-wrap ${t.R >= 4 ? 'rows4' : ''}" id="bwrap"><div class="board" id="board"></div></section>
        <aside class="side">
          <div class="panel detail" id="detail"></div>
          <div class="panel log" id="log"></div>
        </aside>
      </main>
      <footer class="tools">
        <div class="items" id="items"></div>
        <div class="tbtn"><button class="icon-btn" data-act="rules">掟</button><button class="icon-btn" data-act="codexbtn">図鑑</button></div>
      </footer>`, 'trial');
    const board = el.querySelector('#board');
    board.style.setProperty('--cols', t.C);
    board.innerHTML = t.cards.map(cardHTML).join('');
    t.cards.forEach((c) => updateCard(c.i));
    renderHud(); renderCount(); renderDetail(); renderLog(); renderItems();
    const wrap = el.querySelector('#bwrap');
    ro = new ResizeObserver(fitBoard);
    ro.observe(wrap);
    fitBoard();
    if (r.phase === 'gameover') { setTimeout(() => showGameOver(), 200); return; }
    if (t.done && !t.tutorial) { setTimeout(() => showTrialEndOverlay({}), 200); return; }
    if (t.tutorial) { tutStart(); return; }
    if (!t.introSeen) { t.introSeen = true; Game.saveRun(); trialIntro(); }
  }

  function fitBoard() {
    const t = T();
    const wrap = document.getElementById('bwrap');
    if (!t || !wrap) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const gap = clamp(Math.round(Math.min(W, H) * 0.025), 6, 14);
    const ratio = t.R >= 4 ? 1.18 : 1.38;
    let cw = Math.min((W - gap * (t.C - 1) - 12) / t.C, (H - gap * (t.R - 1) - 18) / (t.R * ratio));
    cw = clamp(Math.floor(cw), 44, 150);
    const board = document.getElementById('board');
    board.style.setProperty('--cw', cw + 'px');
    board.style.setProperty('--gap', gap + 'px');
    board.style.setProperty('--ratio', ratio);
  }

  function trialIntro() {
    const t = T();
    const ch = CHAPTERS[t.chapter];
    const ov = document.createElement('div');
    ov.className = 'overlay';
    const first = t.idx === 0;
    const label = ch.final ? '最終審判' : `第${KANJI_NUM[t.idx + 1]}審`;
    ov.innerHTML = `<div class="ov-inner">
      ${first ? `<div class="chap-title"><span>${esc(ch.no)}</span><b>${esc(ch.name)}</b></div><p class="story">${esc(ch.intro)}</p>` : ''}
      <div class="stamp-big" style="font-size:clamp(30px,8vw,46px)">${label}</div>
      ${ch.level ? `<p class="ov-sub" style="color:#ef9aa6;letter-spacing:.3em">難度　${esc(ch.level)}</p>` : ''}
      <p class="ov-sub"><span style="white-space:nowrap">容疑者 ${t.n}人</span>　<span style="white-space:nowrap">虚偽者 ${t.k}人${t.lurk ? `（うち潜伏者 ${t.lurk}人）` : ''}</span>　<span style="white-space:nowrap">惑い者 ${t.u}人</span></p>
      ${t.lurk ? '<p class="ov-sub" style="color:var(--gold)">潜伏者は虚偽者だが、真実しか語らない。矛盾だけでは見つからない。</p>' : ''}
      ${t.misPlus ? `<p class="ov-sub" style="color:#ef9aa6">この廷では、誤った処刑の信用減少が＋${t.misPlus}される。</p>` : ''}
      ${t.boss ? `<p class="ov-sub" style="color:#ef9aa6">この廷には首魁『${esc(ROLE[t.boss].name)}』が潜む。<br><small style="color:var(--ash)">${esc(ROLE[t.boss].desc)}</small></p>` : ''}
      <button class="btn primary" data-act="close-ov">審問を始める</button>
    </div>`;
    app.insertBefore(ov, toastWrap);
    Audio2.play('flip');
  }

  function cardHTML(c) {
    const ro2 = ROLE[c.claim];
    return `<button class="card" data-act="card" data-i="${c.i}" aria-label="${circ(c.i)}">
      <div class="card-in">
        <div class="face back"><span class="num">${circ(c.i)}</span>${EMBLEM}</div>
        <div class="face front"><span class="num">${circ(c.i)}</span>
          <div class="por">${Portrait.make(c.face)}</div>
          <div class="card-meta"><div class="nm">${esc(c.name)}</div><div class="rl"><i class="glyph ${ro2.open ? ro2.align : ''}">${ro2.glyph}</i>${esc(ro2.name)}</div></div>
        </div>
      </div>
      <div class="ovl"></div>
    </button>`;
  }
  const cardEl = (i) => document.querySelector(`.card[data-i="${i}"]`);

  const MARKS = { white: '白', black: '黒', unr: '惑', q: '？' };

  function verdictHTML(c) {
    const cls = c.align === 'evil' ? 'evil' : c.align === 'med' ? 'med' : 'good';
    const label = c.align === 'evil' ? '虚偽者' : c.align === 'med' ? '惑い者' : '無辜';
    let sub = ROLE[c.role].name;
    if (c.afflict) sub += c.afflict === 'poison' ? '・毒' : '・魅了';
    return `<div class="verdict ${cls}">${label}<small>${esc(sub)}</small></div>`;
  }

  function updateCard(i) {
    const t = T(), c = t.cards[i], el = cardEl(i);
    if (!el) return;
    const ro2 = ROLE[c.claim];
    const showAll = t.done || run().phase === 'gameover';
    el.classList.toggle('flipped', c.flipped || showAll);
    el.classList.toggle('selected', sel === i);
    el.classList.toggle('executed', c.executed);
    el.classList.toggle('open-evil', ro2.open && (ro2.align === 'minion' || ro2.align === 'boss'));
    el.classList.toggle('open-med', ro2.open && ro2.align === 'med');
    el.classList.toggle('reveal-evil', (c.executed || showAll) && c.align === 'evil');
    let h = '';
    if (c.mark) h += `<span class="mk ${c.mark}">${MARKS[c.mark]}</span>`;
    if (c.seal) h += `<span class="seal-top"><span class="mk ${c.seal}" title="${c.seal === 'white' ? '無辜と判明' : '惑い者と判明'}">${c.seal === 'white' ? '白' : '惑'}</span></span>`;
    const chips = [];
    if (c.truthShown && c.flipped) chips.push(statementTruth(t, i) ? '<span class="chip t">真</span>' : '<span class="chip f">偽</span>');
    if (c.holy) chips.push(c.holy === 'good' ? '<span class="chip holy-good">善</span>' : '<span class="chip holy-evil">悪</span>');
    if (c.identity) chips.push(`<span class="chip id">${ROLE[c.identity].glyph}</span>`);
    if (c.afflictShown && c.afflict) chips.push(`<span class="chip aff">${c.afflict === 'poison' ? '毒' : '魅'}</span>`);
    if (c.crow != null) chips.push(`<span class="chip id">鴉${c.crow}</span>`);
    if (chips.length) h += `<div class="chips">${chips.join('')}</div>`;
    if (c.executed || showAll) h += verdictHTML(c);
    el.querySelector('.ovl').innerHTML = h;
  }

  function renderHud(prevCred) {
    const r = run();
    const cr = document.getElementById('cred');
    if (!cr) return;
    cr.innerHTML = candlesHTML(r.cred, r.maxCred, prevCred) + `<span class="cred-n">${r.cred}/${r.maxCred}</span>`;
    cr.setAttribute('aria-label', `信用 ${r.cred} / ${r.maxCred}`);
    document.getElementById('silver').innerHTML = `<i class="coin"></i>${r.silver}`;
  }

  function renderCount() {
    const t = T(), r = run();
    const el = document.getElementById('countbar');
    if (!el) return;
    const flipped = t.cards.filter((c) => c.flipped).length;
    const relics = r.relics.map((id) => `<i class="glyph relic" role="button" tabindex="0" data-act="relic" data-id="${id}" title="${esc(RELIC[id].name)}">${RELIC[id].glyph}</i>`).join('');
    el.innerHTML = `
      <span class="liars">虚偽者 <b>${t.evilDown}/${t.k}</b> 処刑</span>
      ${t.lurk ? `<span class="liars" role="button" tabindex="0" data-act="lurkinfo" style="cursor:pointer">うち潜伏者 <b>${t.lurk}</b></span>` : ''}
      <span class="unr">惑い者 <b>${t.u}</b></span>
      <span>尋問 <b>${flipped}/${t.n}</b></span>
      ${t.boss ? `<span role="button" tabindex="0" data-act="bossinfo" style="cursor:pointer">首魁 <b style="color:#ef9aa6">${esc(ROLE[t.boss].name)}</b></span>` : ''}
      ${t.bossRow != null ? `<span class="hint">牙：首魁は上から${KANJI_NUM[t.bossRow + 1]}番目の横列</span>` : ''}
      ${t.pardon ? '<span class="hint">赦免状が効いている</span>' : ''}
      ${Game.agitatorAlive(t) && t.cards.some((c) => c.role === 'agitator' && c.flipped) ? '<span class="hint" style="color:#ef9aa6">扇動者が群衆を煽っている</span>' : ''}
      ${relics ? `<span class="relic-strip">${relics}</span>` : ''}`;
  }

  function renderItems() {
    const r = run();
    const el = document.getElementById('items');
    if (!el) return;
    const n = Game.slotCount();
    let h = '';
    for (let s = 0; s < n; s++) {
      const id = r.items[s];
      if (id) h += `<button class="slot ${targetSlot === s ? 'on' : ''}" data-act="slot" data-slot="${s}"><i class="glyph item">${ITEM[id].glyph}</i>${esc(ITEM[id].name)}</button>`;
      else h += '<span class="slot empty">空き</span>';
    }
    el.innerHTML = h;
  }

  function stopTyping() {
    if (typer) { clearInterval(typer.id); typer = null; }
  }
  function typeInto(el, text, done) {
    stopTyping();
    const speed = SPEEDS[Game.meta.settings.speed];
    const finish = () => { stopTyping(); el.innerHTML = rich(text); if (done) done(); };
    if (!speed) { finish(); return; }
    const p = plain(text);
    let n = 0;
    el.innerHTML = '<span class="caret"></span>';
    typer = {
      finish,
      id: setInterval(() => {
        n++;
        if (n % 2) Audio2.play('tick');
        el.innerHTML = esc(p.slice(0, n)) + '<span class="caret"></span>';
        if (n >= p.length) finish();
      }, 1000 / speed),
    };
  }

  function renderDetail(typeNew) {
    const t = T(), r = run();
    const el = document.getElementById('detail');
    if (!el) return;
    stopTyping();
    if (targetSlot != null) {
      const it = ITEM[r.items[targetSlot]];
      el.innerHTML = `<div class="dt-empty"><p><i class="glyph item">${it.glyph}</i> <b>${esc(it.name)}</b>を使う相手を盤上から選んでください。</p><p>${esc(it.desc)}</p>
        <div class="dt-actions"><button class="btn small ghost" data-act="cancel-target">やめる</button></div></div>`;
      return;
    }
    if (sel == null) {
      const flipped = t.cards.filter((c) => c.flipped).length;
      el.innerHTML = `<div class="dt-empty">
        ${flipped < t.n ? '<p><b>伏せられた札に触れると、その者を尋問します。</b>回数に制限はありませんが、尋問の順番を数える者もいます。</p>' : '<p><b>全員の証言が出揃いました。</b>矛盾を突き合わせ、虚偽者を処刑してください。</p>'}
        <p>無辜は真実を、虚偽者は嘘を語る。惑い者の言葉は当てにならない。</p>
        <p style="color:var(--ash-dim)">尋問済みの札に触れると、詳細と印・処刑の操作が出ます。</p></div>`;
      return;
    }
    const c = t.cards[sel];
    const ro2 = ROLE[c.claim];
    const alignNote = ro2.open ? `<span class="note">${ALIGN_LABEL[ro2.align]}・正体を隠さない</span>` : '<span class="note">名乗った身分</span>';
    const lines = [];
    if (c.truthShown) lines.push(statementTruth(t, sel) ? '<span class="vl t">この証言は真実</span>' : '<span class="vl f">この証言は偽り</span>');
    if (c.holy) lines.push(c.holy === 'good' ? '<span class="vl g">聖水：善</span>' : '<span class="vl f">聖水：悪</span>');
    if (c.identity) lines.push(`<span class="vl g">蝋燭：真の身分は「${esc(ROLE[c.identity].name)}」</span>`);
    if (c.afflictShown && c.afflict) lines.push(`<span class="vl p">${c.afflict === 'poison' ? '毒に侵されている' : '魅了されている'}</span>`);
    if (c.seal === 'white') lines.push('<span class="vl g">無辜と判明</span>');
    if (c.seal === 'unr') lines.push('<span class="vl p">惑い者と判明</span>');
    if (c.crow != null) lines.push(`<span class="vl">鴉の眼：周囲八方に虚偽者${c.crow}人</span>`);
    if (c.executed) lines.push(`<span class="vl ${c.align === 'evil' ? 'f' : 'g'}">処刑済み：${c.align === 'evil' ? '虚偽者' : c.align === 'med' ? '惑い者' : '無辜'}（${esc(ROLE[c.role].name)}）</span>`);
    const ordIdx = t.order.indexOf(sel);
    el.innerHTML = `
      <div class="dt-head">
        <div class="dt-por">${Portrait.make(c.face)}</div>
        <div><div class="dt-name">${circ(sel)} ${esc(c.name)}</div>
        <div class="dt-role"><i class="glyph ${ro2.open ? ro2.align : ''}">${ro2.glyph}</i>${esc(ro2.name)} ${alignNote}</div></div>
      </div>
      <p class="dt-desc">${esc(ro2.desc)}${ordIdx >= 0 ? `　<span style="color:var(--ash-dim)">（${ordIdx + 1}番目に尋問）</span>` : ''}</p>
      <div class="testimony" data-act="skip-type">${c.stmt ? (typeNew ? '' : rich(c.stmt.text)) : '……'}</div>
      ${lines.length ? `<div class="verdict-line">${lines.join('')}</div>` : ''}
      ${!c.executed && !t.done ? `
      <div class="marks"><span>印</span>
        ${Object.entries(MARKS).map(([k, v]) => `<button class="mbtn ${k} ${c.mark === k ? 'on' : ''}" data-act="mark" data-m="${k}" aria-pressed="${c.mark === k}">${v}</button>`).join('')}
      </div>
      <div class="dt-actions"><button class="btn danger" data-act="exec">処刑する</button></div>` : ''}`;
    if (typeNew && c.stmt) typeInto(el.querySelector('.testimony'), c.stmt.text);
  }

  function renderLog() {
    const t = T();
    const el = document.getElementById('log');
    if (!el) return;
    const rows = t.cards.filter((c) => c.flipped).sort((a, b) => a.i - b.i);
    el.innerHTML = `<h3>証言録<small>番号順・触れると選択</small></h3>` + (rows.length ? `<ol>${rows.map((c) => {
      const ro2 = ROLE[c.claim];
      const ord = t.order.indexOf(c.i) + 1;
      const m = [];
      if (c.seal) m.push(`<span class="mk ${c.seal}">${c.seal === 'white' ? '白' : '惑'}</span>`);
      if (c.mark) m.push(`<span class="mk ${c.mark}">${MARKS[c.mark]}</span>`);
      if (c.truthShown) m.push(statementTruth(t, c.i) ? '<span class="chip t">真</span>' : '<span class="chip f">偽</span>');
      return `<li class="${sel === c.i ? 'on' : ''} ${c.executed ? 'dead' : ''}" data-act="log" data-i="${c.i}">
        <span class="ln">${circ(c.i)}</span>
        <div class="lb"><div class="lr">${esc(c.name)}・<span style="color:${ro2.open ? (ro2.align === 'med' ? 'var(--ghost)' : '#ef9aa6') : 'var(--gold)'}">${esc(ro2.name)}</span><span class="ord">#${ord}</span></div>
        <div class="lt">${c.stmt ? rich(c.stmt.text) : '……'}</div></div>
        <span class="lm">${m.join('')}</span></li>`;
    }).join('')}</ol>` : '<div class="log-empty">まだ誰も尋問していない。</div>');
  }

  function highlightRefs() {
    const t = T();
    document.querySelectorAll('.card.ref').forEach((e) => e.classList.remove('ref'));
    if (sel == null) return;
    const c = t.cards[sel];
    if (!c.stmt || !c.flipped) return;
    (c.stmt.refs || []).forEach((j) => { const e = cardEl(j); if (e) e.classList.add('ref'); });
  }

  function select(i, typeNew) {
    const prev = sel;
    sel = i;
    if (prev != null) updateCard(prev);
    if (i != null) updateCard(i);
    renderDetail(typeNew);
    renderLog();
    highlightRefs();
  }

  function onCard(i) {
    if (busy) return;
    const t = T();
    const c = t.cards[i];
    if (targetSlot != null) return applyItem(targetSlot, i);
    if (t.done || run().phase === 'gameover') { select(sel === i ? null : i); return; }
    if (!c.flipped) {
      Game.flip(i);
      Audio2.play('flip');
      updateCard(i);
      select(i, true);
      renderCount();
      if (c.truthShown) setTimeout(() => toast(`${circ(i)}の証言は<b>${statementTruth(t, i) ? '真実' : '偽り'}</b>だ。（聖遺物）`), 700);
      if (c.afflictShown && c.afflict) setTimeout(() => toast(`白骨の指が震える……${circ(i)}は${c.afflict === 'poison' ? '毒' : '魅了'}を受けている。`), 900);
      tutEvent('flip', i);
      // 狭い縦画面では詳細を見せる
      const d = document.getElementById('detail');
      if (d && window.innerHeight > window.innerWidth) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    Audio2.play('select');
    select(sel === i ? null : i);
  }

  function askExecute() {
    const t = T(), c = t.cards[sel];
    if (!c || c.executed) return;
    if (!c.flipped) { toast('尋問していない者は裁けない。', 'bad'); return; }
    const ro2 = ROLE[c.claim];
    confirmBox('処刑の宣告', `${circ(c.i)} ${esc(c.name)}（${esc(ro2.name)}）を処刑しますか。<br><small style="color:var(--ash)">無辜なら信用−${2 + (t.misPlus || 0)}、惑い者なら信用−${1 + (t.misPlus || 0)}${c.claim === 'jester' ? '（道化はさらに重い）' : ''}。</small>`, '処刑する', () => { setTimeout(() => doExecute(c.i), 50); }, true);
  }

  function doExecute(i) {
    const r = run(), t = T();
    busy = true;
    const el = cardEl(i);
    el.classList.add('shake');
    const sl = document.createElement('div'); sl.className = 'slash'; el.appendChild(sl);
    Audio2.play('execute');
    const before = r.cred;
    setTimeout(() => {
      el.classList.remove('shake'); sl.remove();
      const out = t.tutorial ? Game.tutorialExecute(i) : Game.execute(i);
      busy = false;
      if (!out) return;
      const fl = document.createElement('div');
      fl.className = 'flash' + (out.evil ? ' gold' : '');
      app.appendChild(fl); setTimeout(() => fl.remove(), 800);
      updateCard(i);
      renderHud(before);
      renderCount();
      renderDetail();
      renderLog();
      if (out.evil) {
        Audio2.play('good');
        toast(`<b>${esc(t.cards[i].name)}</b>は虚偽者「${esc(ROLE[t.cards[i].role].name)}」だった！${out.silver ? `　銀貨＋${out.silver}` : ''}`, 'good');
      } else {
        Audio2.play('bad');
        const who = t.cards[i].align === 'med' ? '惑い者' : '無辜の者';
        const saved = out.saved === 'pardon' ? '……だが赦免状が信用を守った。' : out.saved === 'kuroneko' ? '……黒猫の骨が災いを払った。' : `信用−${out.penalty}`;
        toast(`<b>${esc(t.cards[i].name)}</b>は${who}だった。${saved}`, 'bad');
      }
      if (out.crow != null) setTimeout(() => toast(`鴉の眼：その者の周囲八方に、虚偽者は${out.crow}人いた。`), 600);
      tutEvent('exec', i, out);
      if (out.gameover) { setTimeout(showGameOver, 1100); return; }
      if (out.win) {
        if (t.tutorial) return;
        setTimeout(() => revealAll(() => showTrialEndOverlay(out)), 700);
      }
    }, 520);
  }

  function revealAll(done) {
    const t = T();
    const hidden = t.cards.filter((c) => !c.flipped);
    hidden.forEach((c, x) => setTimeout(() => { updateCard(c.i); Audio2.play('flip'); }, x * 120));
    t.cards.forEach((c) => setTimeout(() => updateCard(c.i), hidden.length * 120));
    setTimeout(done, hidden.length * 120 + 900);
  }

  function showTrialEndOverlay(out) {
    const r = run(), t = T();
    Audio2.play('victory');
    const w = out.win || {};
    const unlocks = (out.unlocks || []).map((u) => u.kind === 'role'
      ? `<div class="unlock-note">新たな身分『${esc(ROLE[u.id].name)}』が、これからの審判に現れるようになった。</div>`
      : `<div class="unlock-note">新たな聖遺物『${esc(RELIC[u.id].name)}』が見つかるようになった。</div>`).join('');
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="ov-inner">
      <div class="stamp-big">審理終結</div>
      <p class="ov-sub">虚偽者${t.k}人すべてに裁きが下された。</p>
      <div class="ledger">
        ${w.silver != null ? `<div><span>報酬の銀貨</span><span>＋${w.silver}</span></div>` : ''}
        <div><span>誤った処刑</span><span>${t.mis}</span></div>
        ${w.perfect ? '<div><span>完全審理（誤りなし）</span><span>銀貨＋10 込み</span></div>' : ''}
        ${w.healed ? `<div><span>灰の祈祷書</span><span>信用＋${w.healed}</span></div>` : ''}
        <div><span>信用</span><span>${r.cred} / ${r.maxCred}</span></div>
      </div>
      ${unlocks}
      <div class="center-row">
        <button class="btn ghost" data-act="peek">盤面を確かめる</button>
        <button class="btn primary" data-act="to-next">判決を記す</button>
      </div>
    </div>`;
    app.insertBefore(ov, toastWrap);
  }

  function showGameOver() {
    const r = run(), t = T(), m = Game.meta;
    Audio2.play('gameover');
    Audio2.setMood('calm');
    t.cards.forEach((c) => updateCard(c.i));
    const next = ROLES.filter((x) => x.unlock > m.trialsCleared).sort((a, b) => a.unlock - b.unlock)[0];
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="ov-inner">
      <div class="stamp-big bad">解　任</div>
      <p class="ov-sub">信用の灯はすべて消えた。審問官の任を解かれる。</p>
      <div class="ledger">
        <div><span>到達</span><span>${esc(CHAPTERS[r.chapter].no)}　${esc(CHAPTERS[r.chapter].name)}</span></div>
        <div><span>終えた審判</span><span>${r.stats.trials}</span></div>
        <div><span>処刑した虚偽者</span><span>${r.stats.evil}</span></div>
        <div><span>誤った処刑</span><span>${r.stats.mis}</span></div>
        <div><span>階位</span><span>${esc(RANKS[r.rank].name)}</span></div>
      </div>
      ${next ? `<div class="unlock-note">累計審判 ${m.trialsCleared}。あと${next.unlock - m.trialsCleared}審判で、新たな身分が現れる。</div>` : ''}
      <div class="center-row">
        <button class="btn ghost" data-act="peek">盤面を確かめる</button>
        <button class="btn primary" data-act="end-run">タイトルへ</button>
      </div>
    </div>`;
    app.insertBefore(ov, toastWrap);
  }

  function peek() {
    const ov = app.querySelector('.overlay');
    if (!ov) return;
    ov.hidden = true;
    const r = run();
    const bar = document.createElement('div');
    bar.className = 'guide-box';
    bar.style.bottom = 'calc(12px + env(safe-area-inset-bottom, 0px))';
    bar.innerHTML = `<div class="gf" style="margin:0;justify-content:space-between;align-items:center"><span>盤面を確かめています。札に触れると真の身分が見えます。</span><button class="btn small primary" data-act="unpeek">${r.phase === 'gameover' ? '戻る' : '戻る'}</button></div>`;
    app.insertBefore(bar, toastWrap);
  }
  function unpeek() {
    app.querySelectorAll('.guide-box').forEach((n) => n.remove());
    const ov = app.querySelector('.overlay');
    if (ov) ov.hidden = false;
  }

  /* ----- 道具 ----- */
  function onSlot(s) {
    const r = run(), t = T();
    if (t.done || r.phase === 'gameover') return;
    const id = r.items[s];
    if (!id) return;
    const it = ITEM[id];
    Audio2.play('select');
    if (targetSlot === s) { targetSlot = null; renderItems(); renderDetail(); return; }
    if (it.target === 'none') {
      confirmBox(`${it.name}を使う`, esc(it.desc), '使う', () => { setTimeout(() => applyItem(s, null), 0); });
      return;
    }
    targetSlot = s;
    renderItems();
    renderDetail();
  }

  function applyItem(s, target) {
    const t = T();
    const res = Game.useItem(s, target);
    targetSlot = null;
    renderItems();
    if (!res) { renderDetail(); return; }
    if (res.error) { toast(res.error, 'bad'); renderDetail(); return; }
    Audio2.play('item');
    const c = res.card;
    if (res.id === 'holywater') toast(`聖水が${circ(c.i)}に落ちる……<b>${res.result === 'good' ? '善' : '悪'}</b>と出た。`, res.result === 'good' ? '' : 'bad');
    if (res.id === 'scales') toast(`秤が傾く……${circ(c.i)}の証言は<b>${res.result ? '真実' : '偽り'}</b>。`);
    if (res.id === 'candle') toast(`蝋燭が照らす……${circ(c.i)}の真の身分は<b>『${esc(ROLE[res.result].name)}』</b>。`);
    if (res.id === 'pardon') toast('赦免状に署名した。次の誤った処刑は咎められない。');
    if (res.id === 'wine') toast('葡萄酒が喉を潤す。信用＋2。', 'good');
    if (res.id === 'lily') toast(`白百合が${circ(c.i)}の前に置かれた。この者は無辜だ。`, 'good');
    if (c) updateCard(c.i);
    renderHud(); renderCount();
    if (c && c.flipped) select(c.i); else { renderDetail(); renderLog(); }
  }

  /* ========== 報酬 ========== */
  function optionHTML(o, idx, act, priceTag) {
    let glyph, name, desc, kind, cls;
    if (o.type === 'relic') { const x = RELIC[o.id]; glyph = x.glyph; name = x.name; desc = x.desc; kind = 'Relic'; cls = 'relic'; }
    if (o.type === 'item') { const x = ITEM[o.id]; glyph = x.glyph; name = x.name; desc = x.desc; kind = 'Item'; cls = 'item'; }
    if (o.type === 'rest') { glyph = '休'; name = '休息'; desc = `信用を${o.amount}回復する。`; kind = 'Rest'; cls = ''; }
    if (o.type === 'silver') { glyph = '銀'; name = `銀貨 ${o.amount}枚`; desc = '行商人との取引に使える。'; kind = 'Silver'; cls = 'item'; }
    return `<button class="choice ${o.sold ? 'sold' : ''}" data-act="${act}" data-idx="${idx}" ${o.sold ? 'disabled' : ''}>
      <span class="kind">${kind}</span><i class="glyph ${cls}">${glyph}</i><b>${esc(name)}</b><p>${esc(desc)}</p>
      ${priceTag ? `<span class="price"><i class="coin"></i>${o.price}</span>` : ''}</button>`;
  }

  function statusBar() {
    const r = run();
    return `<div class="statusbar">
      <span class="cred">${candlesHTML(r.cred, r.maxCred)}<span class="cred-n">${r.cred}/${r.maxCred}</span></span>
      <span class="silver"><i class="coin"></i>${r.silver}</span>
      <span>道具 ${r.items.length}/${Game.slotCount()}</span>
      ${r.relics.length ? `<span class="relic-strip">${r.relics.map((id) => `<i class="glyph relic" role="button" tabindex="0" data-act="relic" data-id="${id}" title="${esc(RELIC[id].name)}">${RELIC[id].glyph}</i>`).join('')}</span>` : ''}
    </div>`;
  }
  function progressHTML() {
    const r = run();
    let h = '<div class="progress" aria-label="進行">';
    let first = true;
    CHAPTERS.forEach((ch, ci) => {
      if (ch.extra && !r.extended) return;
      if (r.direct && !ch.extra) return;
      if (!first) h += '<span class="sep"></span>';
      first = false;
      ch.trials.forEach((_, ti) => {
        const done = ci < r.chapter || (ci === r.chapter && ti < r.trialIdx) || (ci === r.chapter && ti === r.trialIdx && r.phase !== 'trial');
        const cur = ci === r.chapter && ti === r.trialIdx && r.phase === 'trial';
        h += `<i class="${done ? 'done' : cur ? 'cur' : ''}"></i>`;
      });
    });
    return h + '</div>';
  }

  function showReward() {
    view = 'reward';
    Audio2.setMood('calm');
    const r = run();
    const boss = CHAPTERS[r.chapter].trials[r.trialIdx].boss;
    setScreen(`<div class="page-inner">
      ${progressHTML()}
      <h2>${boss ? '首魁の遺したもの' : '審判の報酬'}</h2>
      <p class="lead">${boss ? '首魁の懐から、古い聖遺物が見つかった。一つを選べ。' : '一つを選べ。'}</p>
      ${statusBar()}
      <div class="choices">${r.reward.options.map((o, i) => optionHTML(o, i, 'take')).join('')}</div>
      <div class="center-row"><button class="btn ghost small" data-act="skip-reward">何も受け取らずに進む</button></div>
    </div>`, 'page');
  }

  function showInterlude() {
    view = 'interlude';
    Audio2.setMood('calm');
    const r = run();
    const ch = CHAPTERS[r.chapter];
    const next = CHAPTERS[r.chapter + 1];
    const OUTRO = [
      '狼の王は斃れ、霧はわずかに薄れた。村人の一人が呟く。「港の司教様が、あれを村へ寄越したのだ」と。',
      '黒衣の司教の杯は割られた。積み荷の帳簿には、都の鐘楼の印章が押されていた。',
      '都の首魁は裁かれた。鐘の音が止んだ夜、大聖堂の扉だけが開いていた。',
      '大聖堂の祈りは途絶えた。最後の扉の向こうで、すべての嘘の源が待っている。',
      '',
      '虚ろの王の冠が床に落ちた。書庫の最奥に、さらに深く降りる螺旋階段が口を開けている。',
    ];
    setScreen(`<div class="page-inner">
      ${progressHTML()}
      <div class="chap-title"><span>${esc(ch.no)}　終幕</span><b>${esc(ch.name)}</b></div>
      <p class="story">${esc(OUTRO[r.chapter] || '')}</p>
      ${statusBar()}
      <div class="orn">Interlude</div>
      <p class="lead">街道の宿。行商人が荷を広げている。</p>
      <div class="choices">${r.shop.goods.map((g, i) => optionHTML(g, i, 'buy', true)).join('')}</div>
      <div class="center-row">
        <button class="btn" data-act="rest" ${r.shop.rested ? 'disabled' : ''}>${r.shop.rested ? '休息を取った' : `宿で休む（信用＋${r.rank >= 5 ? 1 : 2}）`}</button>
        <button class="btn primary" data-act="next-chapter">${esc(next.no)}『${esc(next.name)}』へ</button>
      </div>
    </div>`, 'page');
  }

  function showVictory() {
    view = 'victory';
    Audio2.setMood('calm');
    Audio2.play('victory');
    const r = run(), m = Game.meta;
    const unlockedRank = r.rank + 1 < RANKS.length && m.maxRank >= r.rank + 1;
    setScreen(`<div class="page-inner" style="margin:auto 0;text-align:center">
      <div class="stamp-big" style="font-size:clamp(28px,8.4vw,54px);letter-spacing:.12em;text-indent:.12em">偽りは暴かれた</div>
      <p class="story">偽りの廷主が斃れたとき、廷を満たしていた囁きは一斉に止んだ。<br>蝋燭の灯の下、残されたのは真実だけ。<br>審問官よ、あなたの名は、この夜の記録に刻まれる。</p>
      <div class="ledger" style="max-width:420px;margin:0 auto">
        <div><span>階位</span><span>${esc(RANKS[r.rank].name)}</span></div>
        <div><span>終えた審判</span><span>${r.stats.trials}</span></div>
        <div><span>処刑した虚偽者</span><span>${r.stats.evil}</span></div>
        <div><span>誤った処刑</span><span>${r.stats.mis}</span></div>
        <div><span>残った信用</span><span>${r.cred} / ${r.maxCred}</span></div>
      </div>
      ${unlockedRank ? `<div class="unlock-note" style="max-width:420px;margin:0 auto">新たな階位『${esc(RANKS[r.rank + 1].name)}』で審問できるようになった。</div>` : ''}
      <div class="unlock-note" style="max-width:420px;margin:0 auto">玉座の下に、さらに続く階段が見つかった。<b>外典</b>（超むず・激ムズ）へ、この審問を続けられる。複雑な身分と、真実を語る裏切り者「潜伏者」が待つ。</div>
      <div class="center-row"><button class="btn ghost" data-act="end-run">ここで終える</button><button class="btn primary" data-act="go-extra">続き：外典『${esc(CHAPTERS.find((c) => c.extra).name)}』へ</button></div>
    </div>`, 'page');
  }

  function showVictory2() {
    view = 'victory';
    Audio2.setMood('calm');
    Audio2.play('victory');
    const r = run();
    setScreen(`<div class="page-inner" style="margin:auto 0;text-align:center">
      <div class="chap-title"><span>外典　完</span></div>
      <div class="stamp-big" style="font-size:clamp(28px,8.4vw,54px);letter-spacing:.12em;text-indent:.12em">奈落は閉ざされた</div>
      <p class="story">千の貌は、最後に一つの顔も残さず崩れ落ちた。<br>真実を語る裏切り者さえ見抜いた審問官を、もはや欺ける者はいない。<br>蝋燭が燃え尽きるまで、この夜のことは語り継がれるだろう。</p>
      <div class="ledger" style="max-width:420px;margin:0 auto">
        <div><span>階位</span><span>${esc(RANKS[r.rank].name)}</span></div>
        <div><span>終えた審判</span><span>${r.stats.trials}</span></div>
        <div><span>処刑した虚偽者</span><span>${r.stats.evil}</span></div>
        <div><span>誤った処刑</span><span>${r.stats.mis}</span></div>
        <div><span>残った信用</span><span>${r.cred} / ${r.maxCred}</span></div>
      </div>
      <div class="center-row"><button class="btn primary" data-act="end-run">タイトルへ</button></div>
    </div>`, 'page');
  }

  function startExtraFlow() {
    const m = Game.meta;
    const r = run();
    const go = (rank) => { Game.newExtraRun(rank); showTrial(false, true); };
    const pick = () => {
      if (m.maxRank === 0) return go(0);
      const body = `<div class="rank-list">${RANKS.map((rk, i) => `<button class="rank-opt" data-rank="${i}" ${i > m.maxRank ? 'disabled' : ''}><span class="rn">${['0', 'I', 'II', 'III', 'IV', 'V'][i]}</span><b>${esc(rk.name)}</b><span>${esc(rk.desc)}</span></button>`).join('')}</div>`;
      const md = modal({ title: '外典の階位', body });
      md.el.addEventListener('click', (e) => { const b = e.target.closest('[data-rank]'); if (b && !b.disabled) { md.close(); go(+b.dataset.rank); } });
    };
    const intro = () => modal({
      title: '外典に挑む',
      body: `<p>勝利の後に続く、二つの章だけの審問です。聖遺物2つと道具2つを持って、外典の一章から始めます。</p>
        <p><b style="color:#ef9aa6">外典・壱『深淵の書庫』超むず</b>：4×4の盤、虚偽者5人。複雑な身分が多く現れ、真実を語る裏切り者<b>潜伏者</b>が紛れる。</p>
        <p><b style="color:#ef9aa6">外典・弐『奈落の大法廷』激ムズ</b>：虚偽者6人、潜伏者つき。誤った処刑の信用減少が＋1。</p>`,
      buttons: [{ label: 'やめる', cls: 'ghost' }, { label: '挑む', cls: 'danger', onClick: () => { setTimeout(pick, 0); } }],
    });
    if (r && !r.tutorial && ['trial', 'reward', 'interlude'].includes(r.phase)) {
      confirmBox('外典に挑む', '進行中の審問は破棄されます。よろしいですか。', '破棄して挑む', () => { setTimeout(intro, 0); }, true);
    } else intro();
  }

  /* ========== 各種の帳面 ========== */
  function rulesBody() {
    return `<div class="rules">
      <h4>審問官の務め</h4>
      <ul><li>盤上に潜む<b>虚偽者</b>を全員処刑すれば、その審判は終わる。虚偽者と惑い者の人数は常に示される。</li>
      <li>全${MAIN_CHAPTERS - 1}章（各3審判）と最終審判を越えれば勝利。勝利の後には、続きの<b>外典</b>（超むず・激ムズ）がある。</li></ul>
      <h4>尋問</h4>
      <ul><li>伏せ札に触れると尋問し、その者が<b>名乗る身分</b>と<b>証言</b>が明らかになる。</li>
      <li>回数の制限はない。ただし<b>鐘撞き</b>や<b>墓守</b>のように、尋問の順番を数える者もいる。</li></ul>
      <h4>三つの立場</h4>
      <ul><li><b>無辜</b>：必ず真実を語る。</li>
      <li><b>虚偽者</b>（従者・首魁）：必ず嘘をつく。多くは無辜の身分を騙り、その身分の作法で嘘をつく。一部は正体を隠さない。</li>
      <li><b>惑い者</b>：善側だが、証言は当てにならない。生まれつきの惑い者のほか、<b>毒</b>や<b>魅了</b>を受けた無辜も惑い者として数える。</li>
      <li><b>潜伏者</b>：例外の虚偽者。真実しか語らないので、矛盾からは見つからない。いる時は人数が示される。他の者の証言から追い詰めよう。</li></ul>
      <h4>手がかりの掟</h4>
      <ul><li><b>善側（無辜・惑い者）の身分は重複しない。</b>同じ身分を名乗る者が二人いれば、少なくとも一方は虚偽者。</li>
      <li><b>上下左右</b>＝隣り合う4方向。<b>周囲八方</b>＝斜めを含む8方向。<b>歩</b>＝上下左右に進む歩数。</li>
      <li><b>陣営</b>＝虚偽者か、そうでないか。証言の数には、すでに処刑された者も含まれる。</li>
      <li>「もしAが虚偽者なら、Bは虚偽者だ」という証言は、Aが虚偽者でなければ真実として扱われる。</li>
      <li>盤面によっては、論理だけでは二通りに絞るのが限界のこともある。道具や聖遺物で見極めよう。</li></ul>
      <h4>処刑と信用</h4>
      <ul><li>無辜を処刑すると<b>信用−2</b>、惑い者なら<b>−1</b>（道化は−3）。信用が尽きると<b>解任</b>。</li>
      <li>白・黒・惑・？の<b>印</b>で推理を整理できる。印は判定に影響しない。</li></ul>
      <h4>道具と聖遺物</h4>
      <ul><li><b>道具</b>は一度きりの使い捨て。<b>聖遺物</b>はその審問のあいだ効果が続く。</li>
      <li>審判を終えると報酬を一つ選べる。章の終わりには行商人と宿がある。</li></ul>
    </div>`;
  }
  function showRules() { modal({ title: '廷の掟', body: rulesBody() }); }

  function showCodex(tab = 'good') {
    const m = Game.meta;
    if (m.newUnlocks && m.newUnlocks.length) { m.newUnlocks = []; Game.saveMeta(); }
    const tabs = [['good', '無辜'], ['med', '惑い者'], ['minion', '従者'], ['boss', '首魁']];
    const md = modal({ title: '身分図鑑', body: '' });
    const b = md.el.querySelector('.modal-b');
    const tabsEl = document.createElement('div');
    tabsEl.className = 'tabs';
    b.before(tabsEl);
    const draw = (tb) => {
      tabsEl.innerHTML = tabs.map(([k, v]) => `<button class="tab ${k === tb ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('');
      const list = ROLES.filter((r) => r.align === tb);
      b.innerHTML = list.map((r) => {
        const un = Game.roleUnlocked(r);
        if (!un) return `<div class="entry locked"><i class="glyph">？</i><div class="entry-n">？？？</div><div class="entry-d">${r.extraOnly ? '外典に到達すると明らかになる。' : r.complex ? `外典に到達するか、累計${r.unlock}審判を終えると現れる。` : `累計${r.unlock}審判を終えると現れる。`}</div></div>`;
        return `<div class="entry"><i class="glyph ${r.align}">${r.glyph}</i>
          <div class="entry-n">${esc(r.name)}<small>${ALIGN_LABEL[r.align]}${r.open ? '・正体を隠さない' : ''}${r.finalOnly ? '・終章のみ' : ''}${r.extraOnly ? '・外典のみ' : ''}${r.complex ? '・複雑' : ''}</small></div>
          <div class="entry-d">${esc(r.desc)}<em>${esc(r.lore)}</em></div></div>`;
      }).join('');
      b.scrollTop = 0;
    };
    tabsEl.addEventListener('click', (e) => { const x = e.target.closest('[data-tab]'); if (x) { Audio2.play('select'); draw(x.dataset.tab); } });
    draw(tab);
  }

  function showRelics() {
    const r = run();
    const owned = r && !r.tutorial ? r.relics : [];
    const body = (owned.length ? `<div class="orn" style="margin:6px 0">この審問で所持</div>` + owned.map((id) => {
      const x = RELIC[id];
      return `<div class="entry"><i class="glyph relic">${x.glyph}</i><div class="entry-n">${esc(x.name)}</div><div class="entry-d">${esc(x.desc)}</div></div>`;
    }).join('') + '<div class="orn" style="margin:12px 0 6px">すべての聖遺物</div>' : '') + RELICS.map((x) => {
      const un = Game.relicUnlocked(x);
      return `<div class="entry ${un ? '' : 'locked'}"><i class="glyph relic">${un ? x.glyph : '？'}</i><div class="entry-n">${un ? esc(x.name) : '？？？'}<small>${un ? '' : esc(RELIC_UNLOCK_LABEL[x.unlock])}</small></div><div class="entry-d">${un ? esc(x.desc) : '解禁条件：' + esc(RELIC_UNLOCK_LABEL[x.unlock])}</div></div>`;
    }).join('');
    modal({ title: '聖遺物録', body });
  }

  function showRecords() {
    const m = Game.meta;
    const unRoles = ROLES.filter(Game.roleUnlocked).length;
    const unRelics = RELICS.filter(Game.relicUnlocked).length;
    modal({
      title: '審問の記録',
      body: `<div class="ledger">
        <div><span>審問の回数</span><span>${m.runs}</span></div>
        <div><span>勝利</span><span>${m.wins}</span></div>
        <div><span>累計審判</span><span>${m.trialsCleared}</span></div>
        <div><span>処刑した虚偽者</span><span>${m.evilCaught}</span></div>
        <div><span>誤った処刑</span><span>${m.misExec}</span></div>
        <div><span>最高到達</span><span>${m.bestChapter >= 0 ? esc(CHAPTERS[Math.min(m.bestChapter + 1, CHAPTERS.length - 1)].no) + 'まで' : '―'}</span></div>
        <div><span>到達階位</span><span>${esc(RANKS[m.maxRank].name)}</span></div>
        <div><span>外典</span><span>${m.flags.abyss2 ? '奈落の大法廷まで踏破' : m.flags.abyss1 ? '深淵の書庫を踏破' : m.flags.abyss ? '到達' : '―'}</span></div>
        <div><span>解禁した身分</span><span>${unRoles} / ${ROLES.length}</span></div>
        <div><span>解禁した聖遺物</span><span>${unRelics} / ${RELICS.length}</span></div>
      </div>`,
    });
  }

  function showSettings() {
    const s = Game.meta.settings;
    const md = modal({ title: '設定', body: '' });
    const b = md.el.querySelector('.modal-b');
    const draw = () => {
      b.innerHTML = `
        <div class="setting-row"><span>音楽</span><div class="seg"><button class="${s.bgm ? 'on' : ''}" data-set="bgm" data-v="1">あり</button><button class="${!s.bgm ? 'on' : ''}" data-set="bgm" data-v="0">なし</button></div></div>
        <div class="setting-row"><span>効果音</span><div class="seg"><button class="${s.sfx ? 'on' : ''}" data-set="sfx" data-v="1">あり</button><button class="${!s.sfx ? 'on' : ''}" data-set="sfx" data-v="0">なし</button></div></div>
        <div class="setting-row"><span>文字送り</span><div class="seg">${['遅い', '普通', '速い', '瞬時'].map((l, i) => `<button class="${s.speed === i ? 'on' : ''}" data-set="speed" data-v="${i}">${l}</button>`).join('')}</div></div>
        <div class="setting-row"><span>記録をすべて消す</span><button class="btn small danger" data-set="reset">消去</button></div>
        <p style="color:var(--ash-dim);font-size:12px;margin-top:12px">進行と解禁はこの端末のブラウザに自動で保存されます。</p>`;
    };
    b.addEventListener('click', (e) => {
      const x = e.target.closest('[data-set]');
      if (!x) return;
      Audio2.play('select');
      const k = x.dataset.set;
      if (k === 'reset') {
        confirmBox('記録の消去', '解禁した身分・聖遺物・階位、進行中の審問がすべて失われます。', '消去する', () => {
          Game.resetAll(); md.close(); toast('記録を消去しました。'); showTitle();
        }, true);
        return;
      }
      if (k === 'speed') s.speed = +x.dataset.v;
      else s[k] = x.dataset.v === '1';
      Audio2.setBgm(s.bgm); Audio2.setSfx(s.sfx);
      Game.saveMeta();
      draw();
    });
    draw();
  }

  function showMenu() {
    const r = run();
    const isTut = r && r.tutorial;
    const md = modal({
      title: 'メニュー',
      body: `<div class="menu" style="margin:0">
        <button class="btn" data-m="rules">廷の掟</button>
        <button class="btn" data-m="codex">身分図鑑</button>
        ${isTut ? '' : '<button class="btn" data-m="relics">聖遺物録</button>'}
        <button class="btn" data-m="settings">設定</button>
        ${isTut ? '<button class="btn" data-m="endtut">手ほどきを終える</button>' : '<button class="btn" data-m="title">タイトルへ（自動保存）</button><button class="btn danger" data-m="abandon">審問を放棄する</button>'}
      </div>`,
    });
    md.el.addEventListener('click', (e) => {
      const x = e.target.closest('[data-m]');
      if (!x) return;
      Audio2.play('select');
      const k = x.dataset.m;
      md.close();
      if (k === 'rules') showRules();
      if (k === 'codex') showCodex();
      if (k === 'relics') showRelics();
      if (k === 'settings') showSettings();
      if (k === 'title') showTitle();
      if (k === 'endtut') { Game.endTutorial(); showTitle(); }
      if (k === 'abandon') confirmBox('審問の放棄', 'この審問を終わらせます。解禁の進み具合は残ります。', '放棄する', () => { Game.abandon(); setTimeout(showTitle, 0); }, true);
    });
  }

  /* ========== 手ほどき ========== */
  const TUT = [
    { text: '審問官よ、ようこそ。<br>伏せられた六枚の札が、今宵の容疑者たちだ。この中に<b>虚偽者が一人</b>潜んでいる。', wait: 'next' },
    { text: 'まずは<b>①</b>の札に触れて、尋問してみよう。', wait: 'flip', target: [0] },
    { text: '名乗った身分と証言が明らかになった。<b>無辜は必ず真実を語り、虚偽者は必ず嘘をつく。</b><br>残る五人も、すべて尋問しよう。', wait: 'allflip' },
    { text: '<b>③</b>の告発人は「①は虚偽者だ」と言っている。<br>もし本当に①が虚偽者なら、①の証言は嘘のはずだ。', wait: 'next', target: [2, 0] },
    { text: '①は「上下左右（②と④）に虚偽者は0人」と言った。これが嘘なら、②か④にも虚偽者がいることになる。<br>だが虚偽者は一人だけ――<b>矛盾</b>だ。', wait: 'next', target: [0, 1, 3] },
    { text: 'つまり①は無辜。①を偽って告発した<b>③こそが嘘つき</b>だ。<br>③を選び、「処刑する」を押そう。（印をつけて整理することもできる）', wait: 'exec', target: [2] },
  ];
  function tutStart() {
    tut = { step: 0 };
    tutRender();
  }
  function tutRender() {
    app.querySelectorAll('.guide-box').forEach((n) => n.remove());
    document.querySelectorAll('.card.guide').forEach((e) => e.classList.remove('guide'));
    if (!tut) return;
    const s = TUT[tut.step];
    if (!s) return;
    (s.target || []).forEach((i) => { const e = cardEl(i); if (e) e.classList.add('guide'); });
    const box = document.createElement('div');
    box.className = 'guide-box guide-inline';
    box.innerHTML = `<div class="who">The Elder Inquisitor</div><div>${s.text}</div>
      ${s.wait === 'next' ? '<div class="gf"><button class="btn small primary" data-act="tut-next">次へ</button></div>' : ''}`;
    const side = app.querySelector('.side');
    if (side) { side.prepend(box); side.scrollTop = 0; } else app.insertBefore(box, toastWrap);
  }
  function tutEvent(type, i, out) {
    if (!tut) return;
    const s = TUT[tut.step];
    const t = T();
    if (type === 'exec') {
      if (out && out.evil) {
        tut = null;
        app.querySelectorAll('.guide-box').forEach((n) => n.remove());
        document.querySelectorAll('.card.guide').forEach((e) => e.classList.remove('guide'));
        setTimeout(() => revealAll(() => {
          Audio2.play('victory');
          modal({
            title: '見事だ',
            closable: false,
            body: `<p>虚偽者を全員処刑すれば、審判は終わる。</p>
              <p>誤って無辜を処刑すると、上の<b>信用の蝋燭</b>が消える。すべて消えれば解任だ。</p>
              <p>本番では、善側なのに当てにならない<b>惑い者</b>や、正体を隠さぬ悪、毒を撒く首魁も現れる。掟と図鑑はいつでも開ける。</p>`,
            buttons: [{ label: 'タイトルへ', cls: 'ghost', onClick: () => { Game.endTutorial(); setTimeout(showTitle, 0); } },
              { label: '審問を始める', cls: 'primary', onClick: () => { Game.endTutorial(); setTimeout(startNewFlow, 0); } }],
          });
        }), 600);
      } else {
        setTimeout(() => toast('その者は無辜だった……もう一度、証言を見比べよう。', 'bad'), 400);
      }
      return;
    }
    if (type === 'flip' && s && (s.wait === 'flip')) { tut.step++; tutRender(); return; }
    if (type === 'flip' && s && s.wait === 'allflip' && t.cards.every((c) => c.flipped)) { tut.step++; tutRender(); return; }
    if (type === 'flip' && s && s.wait === 'next' && tut.step === 0) { tut.step = 2; tutRender(); }
  }

  function startTutorial() {
    Game.startTutorial();
    showTrial(false);
  }

  /* ========== 操作の受付 ========== */
  function onClick(e) {
    Audio2.init();
    const a = e.target.closest('[data-act]');
    if (!a || !app.contains(a)) return;
    const act = a.dataset.act;
    switch (act) {
      case 'continue': Audio2.play('select'); route(); break;
      case 'new': Audio2.play('select'); startNewFlow(); break;
      case 'tutorial': Audio2.play('select'); startTutorial(); break;
      case 'new-extra': Audio2.play('select'); startExtraFlow(); break;
      case 'go-extra': Audio2.play('select'); Game.continueExtra(); showTrial(false, true); break;
      case 'lurkinfo': toast(`<b>潜伏者</b>：${esc(ROLE.lurker.desc)}`); break;
      case 'codex': case 'codexbtn': Audio2.play('select'); showCodex(); break;
      case 'relics': Audio2.play('select'); showRelics(); break;
      case 'records': Audio2.play('select'); showRecords(); break;
      case 'settings': Audio2.play('select'); showSettings(); break;
      case 'rules': Audio2.play('select'); showRules(); break;
      case 'menu': Audio2.play('select'); showMenu(); break;
      case 'card': onCard(+a.dataset.i); break;
      case 'log': Audio2.play('select'); select(+a.dataset.i); { const ce = cardEl(+a.dataset.i); if (ce && window.innerHeight > window.innerWidth) ce.scrollIntoView({ block: 'nearest' }); } break;
      case 'ref': {
        e.stopPropagation();
        const j = +a.dataset.ref;
        const ce = cardEl(j);
        if (ce) { ce.classList.add('guide'); setTimeout(() => ce.classList.remove('guide'), 900); }
        Audio2.play('select');
        if (T().cards[j].flipped) select(j);
        break;
      }
      case 'skip-type': if (typer) typer.finish(); break;
      case 'mark': Audio2.play('mark'); Game.setMark(sel, a.dataset.m); updateCard(sel); renderDetail(); renderLog(); break;
      case 'exec': Audio2.play('select'); askExecute(); break;
      case 'slot': onSlot(+a.dataset.slot); break;
      case 'cancel-target': Audio2.play('select'); targetSlot = null; renderItems(); renderDetail(); break;
      case 'relic': { const x = RELIC[a.dataset.id]; toast(`<b>${esc(x.name)}</b>：${esc(x.desc)}`); break; }
      case 'bossinfo': { const x = ROLE[T().boss]; toast(`<b>${esc(x.name)}</b>：${esc(x.desc)}`); break; }
      case 'close-ov': Audio2.play('select'); a.closest('.overlay').remove(); break;
      case 'peek': Audio2.play('select'); peek(); break;
      case 'unpeek': Audio2.play('select'); unpeek(); break;
      case 'to-next': Audio2.play('select'); route(); break;
      case 'end-run': Audio2.play('select'); Game.clearRunOnly(); showTitle(); break;
      case 'take': {
        const res = Game.takeReward(+a.dataset.idx);
        if (res && res.error) { toast(res.error, 'bad'); break; }
        Audio2.play('coin');
        route();
        break;
      }
      case 'skip-reward': Audio2.play('select'); Game.skipReward(); route(); break;
      case 'buy': {
        const res = Game.buy(+a.dataset.idx);
        if (res && res.error) { toast(res.error, 'bad'); break; }
        Audio2.play('coin');
        showInterlude();
        break;
      }
      case 'rest': { const res = Game.rest(); if (res) { Audio2.play('good'); toast(`宿で体を休めた。信用＋${res.amount}。`, 'good'); showInterlude(); } break; }
      case 'next-chapter': Audio2.play('select'); Game.nextChapter(); showTrial(false, true); break;
      case 'tut-next': Audio2.play('select'); tut.step++; tutRender(); break;
      default: break;
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      const m = app.querySelector('.modal-bg:last-of-type');
      if (m) { const x = m.querySelector('[data-x]'); if (x) x.click(); }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
  }

  /* ---------- 舞う埃 ---------- */
  function dust() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.id = 'dust';
    app.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0;
    const ps = range(36).map(() => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.4, v: 0.00008 + Math.random() * 0.00025, d: Math.random() * 6.28 }));
    const resize = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.width = app.clientWidth * dpr; H = cv.height = app.clientHeight * dpr; cv.style.width = '100%'; cv.style.height = '100%'; };
    resize();
    window.addEventListener('resize', resize);
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(50, now - last); last = now;
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.y -= p.v * dt; p.d += 0.0006 * dt;
        p.x += Math.sin(p.d) * 0.00005 * dt;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        ctx.fillStyle = `rgba(232,201,135,${0.18 + 0.2 * Math.sin(p.d * 2) ** 2})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s * (W / app.clientWidth), 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function boot() {
    Game.loadMeta();
    Game.loadRun();
    toastWrap = document.createElement('div');
    toastWrap.className = 'toast-wrap';
    toastWrap.setAttribute('aria-live', 'polite');
    app.appendChild(toastWrap);
    dust();
    Audio2.setBgm(Game.meta.settings.bgm);
    Audio2.setSfx(Game.meta.settings.sfx);
    app.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    showTitle();
  }

  return { boot, toast };
})();
