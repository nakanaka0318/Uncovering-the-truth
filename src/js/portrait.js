'use strict';
/* ===== 肖像：手続き生成のシルエット肖像（SVG） ===== */

const Portrait = (() => {
  const ACCENTS = ['#7a2433', '#3f5a4a', '#3d4a66', '#8a6a2e', '#5b3a5e', '#6b3b2a', '#4a4f57', '#2f4f5a'];
  const BGS = ['#3a2a22', '#2a2a36', '#33262c', '#26302c', '#382e22', '#2c2433'];
  const cache = {};

  function make(seed) {
    if (cache[seed]) return cache[seed];
    const r = new RNG('portrait' + seed);
    const id = 'p' + (hashStr(String(seed)) % 1e8);
    const acc = r.pick(ACCENTS);
    const bg = r.pick(BGS);
    const hrx = 13 + r.int(4), hry = 17 + r.int(4);
    const hy = 60 + r.int(4);
    const hair = r.pick(['short', 'long', 'bun', 'bald', 'curly', 'none']);
    const hat = r.pick(['none', 'none', 'hood', 'tophat', 'brim', 'tricorn', 'veil', 'cap', 'bonnet', 'mitre', 'none']);
    const beard = r.chance(0.28) ? r.pick(['full', 'goatee', 'mustache']) : null;
    const glasses = r.chance(0.12);
    const shoulderW = 34 + r.int(8);
    const eyeY = hy + 1;
    const eyeDx = 5 + r.int(2);
    const top = hy - hry;

    const parts = [];
    const figure = `fill="url(#${id}f)" stroke="url(#${id}r)" stroke-width="1.4"`;
    // 背景
    parts.push(`<rect width="100" height="130" fill="url(#${id}b)"/>`);
    // 長髪（体の後ろ）
    if (hair === 'long' && hat !== 'hood' && hat !== 'veil') {
      parts.push(`<path d="M${50 - hrx - 3},${hy - 4} C${50 - hrx - 6},${hy + 30} ${50 - hrx - 4},${hy + 40} ${50 - hrx + 2},${hy + 44} L${50 + hrx - 2},${hy + 44} C${50 + hrx + 4},${hy + 40} ${50 + hrx + 6},${hy + 30} ${50 + hrx + 3},${hy - 4} Z" ${figure}/>`);
    }
    if (hat === 'hood' || hat === 'veil') {
      const w = hrx + 9;
      parts.push(`<path d="M${50 - w},${hy + 34} C${50 - w - 2},${top - 2} ${50 - 8},${top - 10} 50,${top - 10} C${50 + 8},${top - 10} ${50 + w + 2},${top - 2} ${50 + w},${hy + 34} Z" ${figure}/>`);
    }
    // 肩
    parts.push(`<path d="M${50 - shoulderW - 10},130 C${50 - shoulderW - 8},${hy + 40} ${50 - 16},${hy + 30} 50,${hy + 30} C${50 + 16},${hy + 30} ${50 + shoulderW + 8},${hy + 40} ${50 + shoulderW + 10},130 Z" ${figure}/>`);
    // 襟
    parts.push(`<path d="M${50 - 13},${hy + 31} L50,${hy + 50} L${50 + 13},${hy + 31} L${50 + 8},${hy + 29} L50,${hy + 40} L${50 - 8},${hy + 29} Z" fill="${acc}" opacity="0.85"/>`);
    // 首
    parts.push(`<rect x="44" y="${hy + 12}" width="12" height="${20}" rx="4" fill="url(#${id}f)"/>`);
    // 頭
    parts.push(`<ellipse cx="50" cy="${hy}" rx="${hrx}" ry="${hry}" ${figure}/>`);
    // 髪
    if (hat === 'none' || hat === 'brim' || hat === 'tophat' || hat === 'tricorn' || hat === 'cap') {
      if (hair === 'short') parts.push(`<path d="M${50 - hrx - 1},${hy - 2} C${50 - hrx},${top - 4} ${50 + hrx},${top - 4} ${50 + hrx + 1},${hy - 2} C${50 + hrx - 4},${top + 6} ${50 - hrx + 4},${top + 6} ${50 - hrx - 1},${hy - 2} Z" ${figure}/>`);
      if (hair === 'bun') parts.push(`<circle cx="50" cy="${top - 3}" r="7" ${figure}/>`);
      if (hair === 'curly') for (let x = -2; x <= 2; x++) parts.push(`<circle cx="${50 + x * (hrx / 2.4)}" cy="${top + 2 + Math.abs(x) * 3}" r="5.5" ${figure}/>`);
    }
    // 帽子
    if (hat === 'tophat') parts.push(`<path d="M${50 - hrx - 7},${top + 6} L${50 + hrx + 7},${top + 6} L${50 + hrx + 7},${top + 9} L${50 - hrx - 7},${top + 9} Z M${50 - hrx + 2},${top + 6} L${50 - hrx + 3},${top - 22} L${50 + hrx - 3},${top - 22} L${50 + hrx - 2},${top + 6} Z" ${figure}/><rect x="${50 - hrx + 2.5}" y="${top + 1}" width="${2 * hrx - 5}" height="3" fill="${acc}"/>`);
    if (hat === 'brim') parts.push(`<ellipse cx="50" cy="${top + 7}" rx="${hrx + 14}" ry="4.5" ${figure}/><path d="M${50 - hrx + 1},${top + 6} C${50 - hrx + 2},${top - 12} ${50 + hrx - 2},${top - 12} ${50 + hrx - 1},${top + 6} Z" ${figure}/>`);
    if (hat === 'tricorn') parts.push(`<path d="M${50 - hrx - 10},${top + 8} Q50,${top - 18} ${50 + hrx + 10},${top + 8} Q50,${top + 2} ${50 - hrx - 10},${top + 8} Z" ${figure}/>`);
    if (hat === 'cap') parts.push(`<path d="M${50 - hrx - 1},${top + 9} C${50 - hrx},${top - 6} ${50 + hrx},${top - 6} ${50 + hrx + 1},${top + 9} Z" ${figure}/><path d="M${50 + hrx - 4},${top + 8} L${50 + hrx + 9},${top + 10} L${50 + hrx - 2},${top + 11} Z" ${figure}/>`);
    if (hat === 'bonnet') parts.push(`<path d="M${50 - hrx - 4},${hy + 6} C${50 - hrx - 6},${top - 8} ${50 + hrx + 6},${top - 8} ${50 + hrx + 4},${hy + 6} C${50 + hrx},${top + 4} ${50 - hrx},${top + 4} ${50 - hrx - 4},${hy + 6} Z" ${figure}/>`);
    if (hat === 'mitre') parts.push(`<path d="M${50 - hrx + 1},${top + 7} L${50 - hrx + 3},${top - 14} L50,${top - 24} L${50 + hrx - 3},${top - 14} L${50 + hrx - 1},${top + 7} Z" ${figure}/><path d="M50,${top - 22} L50,${top + 6} M${50 - 5},${top - 6} L${50 + 5},${top - 6}" stroke="${acc}" stroke-width="2"/>`);
    if (hat === 'veil') parts.push(`<path d="M${50 - hrx - 2},${top + 6} C${50 - hrx},${top} ${50 + hrx},${top} ${50 + hrx + 2},${top + 6}" stroke="${acc}" stroke-width="3" fill="none"/>`);
    // 髭
    if (beard === 'full') parts.push(`<path d="M${50 - hrx + 2},${hy + 4} C${50 - hrx + 3},${hy + hry + 8} ${50 + hrx - 3},${hy + hry + 8} ${50 + hrx - 2},${hy + 4} C${50 + 6},${hy + 12} ${50 - 6},${hy + 12} ${50 - hrx + 2},${hy + 4} Z" ${figure}/>`);
    if (beard === 'goatee') parts.push(`<path d="M46,${hy + hry - 5} L50,${hy + hry + 7} L54,${hy + hry - 5} Z" ${figure}/>`);
    if (beard === 'mustache') parts.push(`<path d="M42,${hy + 9} Q50,${hy + 5} 58,${hy + 9} Q50,${hy + 8} 42,${hy + 9} Z" fill="#0b0809"/>`);
    // 目（灯りを映す点）
    const glow = `fill="#e9c98a" opacity="${0.55 + r.next() * 0.3}"`;
    parts.push(`<ellipse cx="${50 - eyeDx}" cy="${eyeY}" rx="1.7" ry="1.1" ${glow}/><ellipse cx="${50 + eyeDx}" cy="${eyeY}" rx="1.7" ry="1.1" ${glow}/>`);
    if (glasses) parts.push(`<circle cx="${50 - eyeDx}" cy="${eyeY}" r="3.4" fill="none" stroke="#c8a25a" stroke-width="0.8" opacity="0.7"/><circle cx="${50 + eyeDx}" cy="${eyeY}" r="3.4" fill="none" stroke="#c8a25a" stroke-width="0.8" opacity="0.7"/>`);

    const lightX = r.chance(0.5) ? 0 : 1;
    const svg = `<svg class="portrait-svg" viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
<radialGradient id="${id}b" cx="${lightX ? 70 : 30}%" cy="30%" r="85%"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#0c090b"/></radialGradient>
<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#231b20"/><stop offset="1" stop-color="#0e0b0d"/></linearGradient>
<linearGradient id="${id}r" x1="${lightX}" y1="0" x2="${1 - lightX}" y2="0.4"><stop offset="0" stop-color="#d9b46a" stop-opacity="0.75"/><stop offset="0.45" stop-color="#d9b46a" stop-opacity="0"/></linearGradient>
</defs>${parts.join('')}</svg>`;
    cache[seed] = svg;
    return svg;
  }
  return { make };
})();
