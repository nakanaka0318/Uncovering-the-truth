'use strict';
/* ===== ゲームデータ：身分・聖遺物・道具・章・階位 ===== */

/*
 * align:
 *   good   … 無辜（常に真実を語る）
 *   med    … 惑い者（善側。証言は当てにならない）
 *   minion … 従者（虚偽者。嘘をつく）
 *   boss   … 首魁（虚偽者。嘘をつく。審判全体に影響）
 * open: true なら正体を隠さず名乗る
 * unlock: 累計審判クリア数がこの値に達すると解禁（0 は最初から）
 */
const ROLES = [
  // ---------- 無辜 ----------
  { id: 'watch', name: '番人', glyph: '番', align: 'good', unlock: 0,
    desc: '自分の上下左右に、虚偽者が何人いるかを語る。',
    lore: '夜ごと門の灯を守る者。目に入るものしか信じない。' },
  { id: 'nightwatch', name: '夜警', glyph: '夜', align: 'good', unlock: 0,
    desc: '自分の周囲八方（斜めを含む）に、虚偽者が何人いるかを語る。',
    lore: '眠らぬ瞳。斜めの影さえ見逃さない。' },
  { id: 'seer', name: '占い師', glyph: '占', align: 'good', unlock: 0,
    desc: '誰か一人について、虚偽者であるかどうかを語る。',
    lore: '水晶に映るは一人の魂のみ。' },
  { id: 'balance', name: '天秤師', glyph: '秤', align: 'good', unlock: 0,
    desc: '二人を名指しし、「そのうちちょうど一人が虚偽者だ」と語る。',
    lore: '片方の皿だけが沈むのを、彼は知っている。' },
  { id: 'surveyor', name: '測量士', glyph: '測', align: 'good', unlock: 0,
    desc: '自分と同じ横一列（自分を除く）に、虚偽者が何人いるかを語る。',
    lore: '縄と杭で、村の境を測ってきた。' },
  { id: 'mason', name: '石工', glyph: '石', align: 'good', unlock: 0,
    desc: '自分と同じ縦一列（自分を除く）に、虚偽者が何人いるかを語る。',
    lore: '積み上げた石の歪みを、指先で知る。' },
  { id: 'nun', name: '修道女', glyph: '修', align: 'good', unlock: 0,
    desc: '誰か一人を「善良な者だ（虚偽者ではない）」と保証する。',
    lore: '祈りは庇護のためにある。' },
  { id: 'accuser', name: '告発人', glyph: '告', align: 'good', unlock: 0,
    desc: '誰か一人を「虚偽者だ」と告発する。',
    lore: '指を差す覚悟だけは、誰にも負けない。' },
  { id: 'gate', name: '門番', glyph: '門', align: 'good', unlock: 0,
    desc: '自分の上下左右に、虚偽者が「いる」か「いない」かを語る。',
    lore: '問うのは一つ。通すか、通さぬか。' },
  { id: 'priest', name: '司祭', glyph: '司', align: 'good', unlock: 0,
    desc: '二人を名指しし、同じ陣営か異なる陣営かを語る。（陣営＝虚偽者か、そうでないか）',
    lore: '告解の重みで、魂の色を量る。' },
  { id: 'confessor', name: '懺悔僧', glyph: '懺', align: 'good', unlock: 0,
    desc: '二人を名指しし、「少なくともどちらかは虚偽者だ」と語る。',
    lore: '聞いた罪の数だけ、皺が深い。' },
  { id: 'locksmith', name: '鍵師', glyph: '鍵', align: 'good', unlock: 0,
    desc: '三人を名指しし、その中に虚偽者が何人いるかを語る。',
    lore: '三つの錠前、開くのはいくつか。' },
  { id: 'bell', name: '鐘撞き', glyph: '鐘', align: 'good', unlock: 3, lazy: true,
    desc: '「自分より先に尋問された者たち」の中に、虚偽者が何人いるかを語る。尋問の順番が重要。',
    lore: '鐘は数える。鳴らされた順に。' },
  { id: 'hunter', name: '猟師', glyph: '猟', align: 'good', unlock: 5,
    desc: '自分に最も近い虚偽者（自分以外）までの距離を語る。距離は上下左右に何歩で辿り着くか。',
    lore: '獣の匂いは、歩数で測る。' },
  { id: 'scribe', name: '写字生', glyph: '写', align: 'good', unlock: 9,
    desc: '番号が偶数（または奇数）の者たちの中に、虚偽者が何人いるかを語る。',
    lore: '帳簿の偶数頁ばかり、なぜか汚れている。' },
  { id: 'doctor', name: '医師', glyph: '医', align: 'good', unlock: 13,
    desc: '誰か一人について、惑い者であるかどうかを語る。',
    lore: '熱、震え、虚ろな目。病は嘘をつかない。' },
  { id: 'grave', name: '墓守', glyph: '墓', align: 'good', unlock: 15, lazy: true,
    desc: '直前に尋問された者について、虚偽者かどうかを語る。（最初に尋問した場合は、誰か一人について語る）',
    lore: '去った者の足跡を、土が覚えている。' },
  { id: 'bard', name: '吟遊詩人', glyph: '詩', align: 'good', unlock: 21,
    desc: '上下左右に隣り合った虚偽者どうしの組が、「ある」か「ない」かを語る。',
    lore: '狼は群れる、と歌は言う。' },
  { id: 'herbal', name: '薬草師', glyph: '薬', align: 'good', unlock: 24,
    desc: '自分の周囲八方に、惑い者が何人いるかを語る。',
    lore: '毒草と薬草は、根の匂いで見分ける。' },
  { id: 'mirror', name: '鏡職人', glyph: '鏡', align: 'good', unlock: 30,
    desc: '誰か一人の証言が、真実か偽りかを語る。',
    lore: '鏡は言葉さえ映し返す。' },
  { id: 'carto', name: '地図師', glyph: '図', align: 'good', unlock: 33,
    desc: '盤の四隅にいる者たちの中に、虚偽者が何人いるかを語る。',
    lore: '地図の端には、いつも怪物が描かれる。' },
  { id: 'numer', name: '数秘術師', glyph: '数', align: 'good', unlock: 40,
    desc: '虚偽者全員の番号を足した数が、奇数か偶数かを語る。',
    lore: '数は魂の影。和は運命の形。' },

  // ---------- 惑い者 ----------
  { id: 'drunk', name: '酔いどれ', glyph: '酔', align: 'med', unlock: 0, policy: 'R',
    desc: '自分を別の無辜の身分だと思い込んでいる。証言は真実のことも偽りのこともある。処刑すると信用−1。',
    lore: '杯の底に、本当の自分を落としてきた。' },
  { id: 'jester', name: '道化', glyph: '道', align: 'med', unlock: 0, open: true, policy: 'R', execCost: 3,
    desc: '正体を隠さない。証言は当てにならない。処刑すると民衆の怒りを買い、信用−3。',
    lore: '笑わせた数だけ、恨みも買った。' },
  { id: 'sleepwalker', name: '夢遊病者', glyph: '夢', align: 'med', unlock: 11, policy: 'F',
    desc: '自分を別の無辜の身分だと思い込み、夢の中の出来事を語る。証言は必ず偽りになる。処刑すると信用−1。',
    lore: '夜ごと歩き、見てもいない景色を語る。' },
  { id: 'zealot', name: '狂信者', glyph: '狂', align: 'med', unlock: 27, open: true, policy: 'R',
    desc: '正体を隠さない。誰かを「虚偽者だ」と叫ぶが、当たるとは限らない。処刑すると信用−1。',
    lore: '炎は罪人も聖人も区別しない。' },

  // ---------- 従者 ----------
  { id: 'perjurer', name: '偽証人', glyph: '偽', align: 'minion', unlock: 0,
    desc: '無辜の身分を騙り、その身分の作法で嘘をつく。',
    lore: '口を開けば、滑らかに偽りが零れる。' },
  { id: 'poisoner', name: '毒婦', glyph: '毒', align: 'minion', unlock: 0, open: true,
    desc: '正体を隠さない。周囲八方の無辜一人に毒を盛り、惑い者にする（毒を受けた者の証言は当てにならない）。毒を盛った相手について嘘をつく。',
    lore: '杯を差し出す手は、いつも優しい。' },
  { id: 'spy', name: '密偵', glyph: '密', align: 'minion', unlock: 7,
    desc: '無辜の身分を騙り、嘘をつく。聖水を受けても「善」と出る。',
    lore: '聖水の冷たささえ、演技のうち。' },
  { id: 'mimic', name: '変装師', glyph: '変', align: 'minion', unlock: 18,
    desc: '実際に盤上にいる無辜と同じ身分を騙る。善側の身分は重複しないため、同じ身分が二人いれば片方は偽物。',
    lore: '顔も声も、そっくり盗んでみせる。' },
  { id: 'agitator', name: '扇動者', glyph: '扇', align: 'minion', unlock: 36, open: true,
    desc: '正体を隠さない。生きている間、誤った処刑の信用減少が＋1される。無辜を虚偽者だと告発する。',
    lore: '群衆の怒りは、薪より良く燃える。' },

  // ---------- 首魁 ----------
  { id: 'wolfking', name: '狼の王', glyph: '狼', align: 'boss', unlock: 0,
    desc: '無辜の身分を騙り、嘘をつく。周囲八方の無辜一人を魅了し、惑い者にする（魅了された者の証言は必ず偽りになる）。',
    lore: '牙を隠し、群れの長として微笑む。' },
  { id: 'bishop', name: '黒衣の司教', glyph: '黒', align: 'boss', unlock: 0,
    desc: '無辜の身分を騙り、嘘をつく。盤上の無辜二人に毒を盛り、惑い者にする。',
    lore: '聖杯に満たされたのは、葡萄酒ではなかった。' },
  { id: 'masked', name: '仮面の判事', glyph: '仮', align: 'boss', unlock: 45,
    desc: '無辜の身分を騙り、嘘をつく。聖水では「善」と出て、蝋燭の灯は偽りの身分を映す。',
    lore: '裁く者の仮面の下を、誰も見たことがない。' },
  { id: 'lord', name: '偽りの廷主', glyph: '廷', align: 'boss', unlock: 0, finalOnly: true,
    desc: '無辜の身分を騙り、嘘をつく。無辜一人に毒を、もう一人に魅了をかける。聖水では「善」と出る。',
    lore: 'この廷のすべての嘘は、彼のために編まれた。' },
];
const ROLE = Object.fromEntries(ROLES.map((r) => [r.id, r]));
const ALIGN_LABEL = { good: '無辜', med: '惑い者', minion: '従者', boss: '首魁' };

/* ===== 道具 ===== */
const ITEMS = [
  { id: 'holywater', name: '聖水', glyph: '水', price: 18, target: 'any',
    desc: '一人に聖水を垂らし、善か悪かを見極める。（一部の虚偽者は「善」と偽る）' },
  { id: 'scales', name: '真偽の秤', glyph: '秤', price: 20, target: 'flipped',
    desc: '尋問済みの一人の証言が、真実か偽りかを量る。' },
  { id: 'candle', name: '審問の蝋燭', glyph: '燭', price: 26, target: 'any',
    desc: '一人の真の身分を照らし出す。（仮面の判事には欺かれる）' },
  { id: 'pardon', name: '赦免状', glyph: '赦', price: 15, target: 'none',
    desc: '使うと、この審判で次に誤った処刑をしても信用が減らない。' },
  { id: 'wine', name: '葡萄酒', glyph: '葡', price: 16, target: 'none',
    desc: '信用を2回復する。' },
  { id: 'lily', name: '白百合', glyph: '百', price: 15, target: 'none',
    desc: 'まだ明らかでない無辜を一人、白として示す。' },
];
const ITEM = Object.fromEntries(ITEMS.map((r) => [r.id, r]));

/* ===== 聖遺物 ===== */
const RELICS = [
  { id: 'tenbin', name: '銀の天秤', glyph: '天', unlock: 'base',
    desc: '各審判で、無作為な一人の証言の真偽が、尋問した時に明らかになる。' },
  { id: 'gantai', name: '盲目の聖女の眼帯', glyph: '眼', unlock: 'base',
    desc: '各審判の開始時、無作為な無辜一人が白として示される。' },
  { id: 'seiyaku', name: '鉄の誓約', glyph: '誓', unlock: 'base',
    desc: '最大信用＋2。手に入れた時、信用＋2。' },
  { id: 'hoten', name: '古き法典', glyph: '典', unlock: 'base',
    desc: '各審判で最初の誤った処刑による信用減少を1軽くする。' },
  { id: 'kitosho', name: '灰の祈祷書', glyph: '祈', unlock: 'base',
    desc: '誤った処刑なしで審判を終えると、信用＋1。' },
  { id: 'yubiwa', name: '告発者の指輪', glyph: '環', unlock: 'base',
    desc: '虚偽者を処刑するたび、銀貨＋4。' },
  { id: 'gaito', name: '審問官の外套', glyph: '套', unlock: 'base',
    desc: '道具を持てる数＋1。' },
  { id: 'seihai', name: '聖灰の小瓶', glyph: '灰', unlock: 'base',
    desc: '各審判の開始時、33%の確率で聖水を得る。' },
  { id: 'kagi', name: '錆びた鍵', glyph: '鍵', unlock: 'base',
    desc: '行商人の品がすべて3割引きになる。' },
  { id: 'karasu', name: '鴉の眼', glyph: '鴉', unlock: 'ch1',
    desc: '処刑した者の周囲八方に、虚偽者が何人いたかがわかる。' },
  { id: 'kiba', name: '狼の牙', glyph: '牙', unlock: 'ch2',
    desc: '首魁のいる審判で、首魁がいる横一列がわかる。' },
  { id: 'hakkotsu', name: '白骨の指', glyph: '骨', unlock: 'ch3',
    desc: '毒や魅了を受けた者を尋問すると、その印が浮かぶ。' },
  { id: 'shokan', name: '蝋封の書簡', glyph: '封', unlock: 't20',
    desc: '各審判の開始時、惑い者が一人判明する（いれば）。' },
  { id: 'kuroneko', name: '黒猫の骨', glyph: '猫', unlock: 't12',
    desc: '誤った処刑の時、50%の確率で信用が減らない。' },
  { id: 'kanenoshita', name: '鐘の舌', glyph: '舌', unlock: 't6',
    desc: '各審判で最初に尋問した者の証言の真偽がわかる。' },
  { id: 'sakazuki', name: '秘蹟の杯', glyph: '杯', unlock: 'win',
    desc: '審判後の報酬の選択肢が1つ増える。' },
];
const RELIC = Object.fromEntries(RELICS.map((r) => [r.id, r]));
const RELIC_UNLOCK_LABEL = {
  base: '最初から', ch1: '第一章を突破する', ch2: '第二章を突破する', ch3: '第三章を突破する',
  win: '偽りの廷を裁く', t6: '累計6審判を終える', t12: '累計12審判を終える', t20: '累計20審判を終える',
};

/* ===== 章構成 =====
 * R,C: 盤の行・列 / k: 虚偽者数（首魁を含む）/ m: 生来の惑い者数 / boss: 首魁
 */
const CHAPTERS = [
  { name: '霧の寒村', no: '第一章', boss: 'wolfking',
    intro: '霧に閉ざされた寒村で、家畜が喉を裂かれた。村人たちは互いを見つめ、口を閉ざしている。',
    trials: [{ R: 2, C: 3, k: 1, m: 0 }, { R: 2, C: 3, k: 2, m: 0 }, { R: 2, C: 4, k: 2, m: 0, boss: true }] },
  { name: '灰の港町', no: '第二章', boss: 'bishop',
    intro: '灰が降る港町。積み荷と一緒に、偽りもまた陸へ揚げられた。',
    trials: [{ R: 2, C: 4, k: 2, m: 0 }, { R: 3, C: 3, k: 2, m: 1 }, { R: 3, C: 3, k: 3, m: 0, boss: true }] },
  { name: '鐘楼の都', no: '第三章', boss: 'masked',
    intro: '鐘の音が絶えない都。鳴らされた順に、人は嘘を重ねてゆく。',
    trials: [{ R: 3, C: 3, k: 2, m: 1 }, { R: 3, C: 4, k: 3, m: 1 }, { R: 3, C: 4, k: 3, m: 1, boss: true }] },
  { name: '大聖堂', no: '第四章', boss: 'any',
    intro: '聖なる穹窿の下、祈りの声に紛れて、囁きが交わされている。',
    trials: [{ R: 3, C: 4, k: 3, m: 1 }, { R: 3, C: 4, k: 3, m: 2 }, { R: 3, C: 4, k: 4, m: 1, boss: true }] },
  { name: '偽りの廷', no: '終章', boss: 'lord', final: true,
    intro: 'すべての嘘が流れ着く場所。審問官よ、最後の法廷に立て。',
    trials: [{ R: 3, C: 4, k: 4, m: 1, boss: true }] },
];

/* ===== 階位（難易度） ===== */
const RANKS = [
  { name: '見習い審問官', desc: '標準の審問。' },
  { name: '助祭審問官', desc: '開始時の信用−1。' },
  { name: '司祭審問官', desc: '第二章以降、惑い者が1人増える。' },
  { name: '司教審問官', desc: '審判後の報酬の選択肢が1つ減る。' },
  { name: '大司教審問官', desc: '第三章以降、虚偽者が1人増える。' },
  { name: '枢機卿審問官', desc: '誤った処刑による信用減少が＋1される。' },
];

const BASE_CRED = 6;

const NAMES = [
  'エルマ', 'ヨハン', 'ギーゼラ', 'マティアス', 'リーゼル', 'オスヴァルト', 'ヘルガ', 'ベルント', 'イルザ',
  'コンラート', 'ドロテア', 'フリーダ', 'ゲルト', 'ハンナ', 'ルートヴィヒ', 'アグネス', 'ヴィルマ', 'クラウス',
  'ミルダ', 'テオバルト', 'ウルスラ', 'ローザ', 'ファルク', 'エッダ', 'ニコラス', 'マルタ', 'ディートリヒ',
  'ゾフィー', 'アルブレヒト', 'ベアタ', 'カスパー', 'ヘドヴィヒ', 'ルーカス', 'オディール', 'ヴェンデル',
  'グレーテ', 'ラザルス', 'アンセルム', 'セラフィナ', 'バルタザール', 'エーミール', 'ティルダ', 'ノルベルト',
  'イーダ', 'レオポルト', 'フーゴ', 'ジルケ', 'ベネディクト', 'カタリナ', 'ヴォルフラム', 'ミヒャエラ', 'オトマール',
];
