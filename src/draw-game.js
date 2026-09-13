import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { PassThrough } from 'node:stream';
import * as PImage from 'pureimage';
import { getDrawSettings, recordResult } from './store.js';
import { activeGames } from './games-engine.js';

const ROUNDS = 10;
const MIN_PLAYERS = 3;
const ROUND_SECONDS = 30;
const FRAME_COUNT = 6;
const FRAME_INTERVAL_MS = Math.floor((ROUND_SECONDS * 1000) / FRAME_COUNT);

const WORDS = [
  { answer: 'شمس', aliases: ['شمس'], difficulty: 'easy', clue: 'شيء كيبان فالسماء وكيعطي الضوء والدفء.', draw: 'sun' },
  { answer: 'قطة', aliases: ['قطة', 'قط'], difficulty: 'easy', clue: 'حيوان أليف صغير كيموء.', draw: 'cat' },
  { answer: 'بيت', aliases: ['بيت', 'منزل', 'دار'], difficulty: 'easy', clue: 'مكان كيسكنو فيه الناس.', draw: 'house' },
  { answer: 'كرة', aliases: ['كرة'], difficulty: 'easy', clue: 'شيء دائري كنلعبو به بزاف ديال الألعاب.', draw: 'ball' },
  { answer: 'شجرة', aliases: ['شجرة'], difficulty: 'easy', clue: 'نبات كبير عندو جذع وفروع.', draw: 'tree' },
  { answer: 'تفاحة', aliases: ['تفاحة', 'تفاح'], difficulty: 'easy', clue: 'فاكهة معروفة ويمكن تكون حمراء أو خضراء.', draw: 'apple' },
  { answer: 'بيتزا', aliases: ['بيتزا'], difficulty: 'medium', clue: 'أكلة دائرية عليها الجبن ومكونات مختلفة.', draw: 'pizza' },
  { answer: 'سيارة', aliases: ['سيارة', 'عربية'], difficulty: 'medium', clue: 'وسيلة نقل بأربع عجلات.', draw: 'car' },
  { answer: 'طائرة', aliases: ['طائرة', 'طيارة'], difficulty: 'medium', clue: 'وسيلة نقل كتطير فالسماء.', draw: 'plane' },
  { answer: 'مظلة', aliases: ['مظلة', 'شمسية'], difficulty: 'medium', clue: 'كتستعمل للحماية من الشتا أو الشمس.', draw: 'umbrella' },
  { answer: 'كاميرا', aliases: ['كاميرا'], difficulty: 'medium', clue: 'آلة كتستعمل لالتقاط الصور.', draw: 'camera' },
  { answer: 'ساعة', aliases: ['ساعة'], difficulty: 'medium', clue: 'كتعطيك الوقت.', draw: 'clock' },
  { answer: 'غيتار', aliases: ['غيتار', 'قيتار'], difficulty: 'hard', clue: 'آلة موسيقية عندها أوتار.', draw: 'guitar' },
  { answer: 'صاروخ', aliases: ['صاروخ'], difficulty: 'hard', clue: 'مركبة كتقدر تمشي للفضاء.', draw: 'rocket' },
  { answer: 'تاج', aliases: ['تاج'], difficulty: 'hard', clue: 'كيترمز للملك أو الملكة.', draw: 'crown' },
  { answer: 'قطار', aliases: ['قطار'], difficulty: 'hard', clue: 'وسيلة نقل كتسافر فوق السكة.', draw: 'train' },
  { answer: 'كعكة', aliases: ['كعكة', 'كيكة', 'طورطة'], difficulty: 'hard', clue: 'حلوى كتكون حاضرة فالحفلات والمناسبات.', draw: 'cake' },
  { answer: 'حاسوب', aliases: ['حاسوب', 'كمبيوتر', 'كومبيوتر'], difficulty: 'hard', clue: 'جهاز إلكتروني كنستعملوه للعمل والألعاب.', draw: 'computer' },
];

const difficultyRank = { easy: 1, medium: 2, hard: 3 };
const scoreCap = { easy: 140, medium: 220, hard: 300 };

const rand = max => Math.floor(Math.random() * max);
const keygen = () => Math.random().toString(36).slice(2, 10);

function escapeMentions(text) {
  return String(text || '').replaceAll('@everyone', '@ everyone').replaceAll('@here', '@ here');
}

function normalize(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\s_\-]+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
}

function matchingPool(difficulty) {
  const rank = difficultyRank[difficulty] || 3;
  return WORDS.filter(word => difficultyRank[word.difficulty] <= rank);
}

function pickWord(state) {
  const pool = matchingPool(state.settings.difficulty);
  const used = state.usedAnswers;
  const available = pool.filter(word => !used.has(word.answer));
  const selected = rand((available.length ? available : pool).length);
  const word = (available.length ? available : pool)[selected];
  used.add(word.answer);
  return word;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function hiddenWord(word) {
  return [...word.answer].map(char => /[\u0600-\u06FF\u0041-\u007A]/.test(char) ? '＿' : char).join(' ');
}

function revealLetters(answer, count = 2) {
  const indices = [...answer]
    .map((char, index) => /[\u0600-\u06FF\u0041-\u007A]/.test(char) ? index : -1)
    .filter(index => index >= 0);
  const selected = shuffle(indices).slice(0, Math.min(count, indices.length));
  return [...answer].map((char, index) => selected.includes(index) ? char : '＿').join(' ');
}

function roundHeader(state, word, remainingSeconds) {
  return new EmbedBuilder()
    .setTitle('🎨 خمّن الرسمة')
    .setDescription([
      `**الجولة ${state.round} / ${ROUNDS}**`,
      `⏱️ باقي: **${Math.max(0, Math.ceil(remainingSeconds))}ث**`,
      '',
      `الكلمة: **${hiddenWord(word)}**`,
      '',
      '👀 شوف تفاصيل الرسمة وخمنها فالشات.',
      '💡 عندك **تلميح واحد فقط** فهاد اللعبة، وكيبان ليك بوحدك.',
    ].join('\n'))
    .setFooter({ text: 'أول تخمين صحيح كيربح الجولة • التخمينات الخاطئة ما عليها حتى عقوبة' });
}

function lobbyEmbed(state, remaining) {
  return new EmbedBuilder()
    .setTitle('🎨 خمّن الرسمة')
    .setDescription([
      escapeMentions(state.settings.startMessage || 'شوف الرسمة، ركز فالتفاصيل، وحاول تكون أول واحد يخمنها!'),
      '',
      `👥 اللاعبون: **${state.players.length}/${state.settings.maxPlayers}**`,
      `✅ الحد الأدنى: **${MIN_PLAYERS}**`,
      `⏱️ البداية بعد: **${Math.max(0, Math.ceil(remaining))}ث**`,
      `🧩 الصعوبة: **${difficultyName(state.settings.difficulty)}**`,
      `🎞️ نمط الرسم: **${state.settings.animated ? 'متدرج متحرك' : 'صور متدرجة'}**`,
      '',
      'اضغط **انضمام** باش تدخل، وخرج من الجولة ماشي ممكن من بعد البداية.',
    ].join('\n'));
}

function difficultyName(value) {
  return value === 'easy' ? 'سهل' : value === 'medium' ? 'متوسط' : 'صعب';
}

function lobbyButtons(state, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`drawlobby:${state.key}:join`).setLabel('انضمام').setEmoji('🎮').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`drawlobby:${state.key}:start`).setLabel('بدء').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`drawlobby:${state.key}:cancel`).setLabel('إلغاء').setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  )];
}

function roundButtons(state) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`draw:${state.key}:hint`).setLabel('تلميح').setEmoji('💡').setStyle(ButtonStyle.Secondary),
  )];
}

function drawEmbed(state, word, remaining) {
  return roundHeader(state, word, remaining);
}

function finishEmbed(state, rows) {
  const ranked = [...state.totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const lines = ranked.length
    ? ranked.map(([id, points], index) => `**${index + 1}.** <@${id}> — **${points} نقطة**${state.roundWins.get(id) ? ` • ${state.roundWins.get(id)} جولات` : ''}`).join('\n')
    : 'ما كاين حتى نقاط.';
  const winners = ranked.length ? ranked[0][0] : null;
  return new EmbedBuilder()
    .setTitle('🏁 خمّن الرسمة انتهات')
    .setDescription([
      `تم لعب **${ROUNDS} جولات**.`,
      '',
      '🏆 **الترتيب النهائي**',
      lines,
      '',
      winners ? `👑 البطل: <@${winners}>` : '😅 ما ربح حتى واحد.',
      '',
      rows.length ? `📈 أعلى نقاط الجولة: **${Math.max(...rows.map(row => row.points))}**` : '',
    ].filter(Boolean).join('\n'));
}

function createCanvas(width = 760, height = 480) {
  const image = PImage.make(width, height);
  const ctx = image.getContext('2d');
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#263238';
  ctx.fillStyle = '#263238';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { image, ctx };
}

function circle(ctx, x, y, r, fill = null, stroke = '#263238', line = 8) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}

function line(ctx, x1, y1, x2, y2, width = 8) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.stroke();
}

function rect(ctx, x, y, w, h, fill = null, stroke = '#263238', lineWidth = 8, radius = 0) {
  ctx.beginPath();
  if (radius && ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function drawSun(ctx, frame) {
  const r = frame >= 2 ? 70 : 48;
  circle(ctx, 370, 210, r, '#ffd54f', frame >= 1 ? '#f57f17' : '#ffd54f', 8);
  if (frame >= 2) for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    line(ctx, 370 + Math.cos(a) * 95, 210 + Math.sin(a) * 95, 370 + Math.cos(a) * 125, 210 + Math.sin(a) * 125, 7);
  }
  if (frame >= 4) {
    circle(ctx, 350, 195, 5, '#263238', null, 0);
    circle(ctx, 390, 195, 5, '#263238', null, 0);
    ctx.beginPath(); ctx.arc(370, 220, 25, 0, Math.PI); ctx.stroke();
  }
  if (frame >= 5) {
    line(ctx, 115, 360, 625, 360, 7);
    for (let x = 140; x < 620; x += 70) line(ctx, x, 360, x - 20, 405, 5);
  }
}

function drawCat(ctx, frame) {
  circle(ctx, 380, 230, 105, '#ffcc80', '#8d5524', 8);
  ctx.beginPath(); ctx.moveTo(305, 160); ctx.lineTo(325, 95); ctx.lineTo(365, 145); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(395, 145); ctx.lineTo(440, 95); ctx.lineTo(455, 170); ctx.stroke();
  if (frame >= 2) { circle(ctx, 345, 220, 8, '#263238', null, 0); circle(ctx, 415, 220, 8, '#263238', null, 0); }
  if (frame >= 3) { circle(ctx, 380, 255, 12, '#e57373', '#8d5524', 5); line(ctx, 380, 267, 350, 290, 5); line(ctx, 380, 267, 410, 290, 5); }
  if (frame >= 4) { line(ctx, 280, 255, 225, 240, 5); line(ctx, 280, 275, 220, 280, 5); line(ctx, 480, 255, 535, 240, 5); }
  if (frame >= 5) { ctx.beginPath(); ctx.arc(535, 320, 85, -1.3, 1.2); ctx.stroke(); }
}

function drawHouse(ctx, frame) {
  if (frame >= 1) rect(ctx, 230, 190, 300, 190, '#ffe0b2', '#6d4c41', 8);
  if (frame >= 2) { ctx.beginPath(); ctx.moveTo(205, 195); ctx.lineTo(380, 75); ctx.lineTo(555, 195); ctx.closePath(); ctx.fillStyle = '#ef9a9a'; ctx.fill(); ctx.strokeStyle = '#6d4c41'; ctx.stroke(); }
  if (frame >= 3) rect(ctx, 345, 285, 70, 95, '#8d6e63', '#5d4037', 7);
  if (frame >= 4) { rect(ctx, 270, 235, 65, 60, '#81d4fa', '#1565c0', 7); rect(ctx, 425, 235, 65, 60, '#81d4fa', '#1565c0', 7); }
  if (frame >= 5) { circle(ctx, 130, 340, 45, '#81c784', '#388e3c', 7); circle(ctx, 630, 340, 45, '#81c784', '#388e3c', 7); line(ctx, 80, 390, 675, 390, 7); }
}

function drawBall(ctx, frame) {
  circle(ctx, 380, 250, frame >= 2 ? 105 : 70, '#90caf9', '#1565c0', 9);
  if (frame >= 3) {
    line(ctx, 305, 185, 350, 230, 7); line(ctx, 455, 185, 410, 230, 7);
    line(ctx, 300, 320, 350, 270, 7); line(ctx, 460, 320, 410, 270, 7);
  }
  if (frame >= 4) { circle(ctx, 380, 250, 28, '#ffffff', '#263238', 6); }
  if (frame >= 5) { line(ctx, 380, 145, 380, 355, 5); line(ctx, 275, 250, 485, 250, 5); }
}

function drawTree(ctx, frame) {
  if (frame >= 1) rect(ctx, 340, 235, 80, 160, '#8d6e63', '#5d4037', 7);
  if (frame >= 2) { circle(ctx, 380, 190, 110, '#81c784', '#2e7d32', 8); circle(ctx, 300, 220, 70, '#81c784', '#2e7d32', 7); circle(ctx, 460, 220, 70, '#81c784', '#2e7d32', 7); }
  if (frame >= 3) { line(ctx, 380, 270, 335, 330, 7); line(ctx, 380, 270, 430, 330, 7); }
  if (frame >= 4) { circle(ctx, 320, 160, 10, '#ffcc80', null, 0); circle(ctx, 420, 150, 10, '#ffcc80', null, 0); }
  if (frame >= 5) line(ctx, 180, 395, 580, 395, 7);
}

function drawApple(ctx, frame) {
  circle(ctx, 345, 250, 78, '#ef5350', '#b71c1c', 8); circle(ctx, 420, 250, 78, '#ef5350', '#b71c1c', 8);
  if (frame >= 2) { line(ctx, 382, 175, 400, 125, 10); line(ctx, 395, 135, 450, 115, 7); }
  if (frame >= 3) { circle(ctx, 435, 115, 28, '#66bb6a', '#2e7d32', 6); }
  if (frame >= 5) line(ctx, 245, 350, 520, 350, 6);
}

function drawPizza(ctx, frame) {
  ctx.beginPath(); ctx.moveTo(195, 130); ctx.lineTo(585, 160); ctx.lineTo(355, 390); ctx.closePath();
  ctx.fillStyle = '#ffd180'; ctx.fill(); ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 8; ctx.stroke();
  if (frame >= 2) { circle(ctx, 315, 190, 18, '#ef5350', '#b71c1c', 5); circle(ctx, 410, 210, 18, '#ef5350', '#b71c1c', 5); }
  if (frame >= 3) { circle(ctx, 370, 285, 18, '#66bb6a', '#2e7d32', 5); circle(ctx, 465, 250, 18, '#ef5350', '#b71c1c', 5); }
  if (frame >= 4) { line(ctx, 245, 205, 540, 225, 6); line(ctx, 260, 250, 480, 275, 6); }
  if (frame >= 5) { ctx.beginPath(); ctx.arc(390, 165, 185, 0.1, 1.1); ctx.stroke(); }
}

function drawCar(ctx, frame) {
  if (frame >= 1) rect(ctx, 175, 240, 420, 110, '#ef5350', '#b71c1c', 8, 18);
  if (frame >= 2) { ctx.beginPath(); ctx.moveTo(250, 240); ctx.lineTo(315, 175); ctx.lineTo(470, 175); ctx.lineTo(525, 240); ctx.closePath(); ctx.fillStyle = '#ffcdd2'; ctx.fill(); ctx.stroke(); }
  if (frame >= 3) { circle(ctx, 270, 360, 45, '#263238', '#111827', 7); circle(ctx, 500, 360, 45, '#263238', '#111827', 7); }
  if (frame >= 4) { line(ctx, 330, 185, 330, 235, 6); line(ctx, 420, 185, 420, 235, 6); }
  if (frame >= 5) { circle(ctx, 205, 285, 12, '#fff59d', '#f9a825', 5); circle(ctx, 570, 285, 12, '#fff59d', '#f9a825', 5); }
}

function drawPlane(ctx, frame) {
  if (frame >= 1) { line(ctx, 190, 275, 575, 220, 12); line(ctx, 360, 250, 290, 135, 12); }
  if (frame >= 2) { line(ctx, 350, 250, 310, 360, 12); line(ctx, 435, 240, 530, 320, 12); }
  if (frame >= 3) { circle(ctx, 230, 270, 18, '#90caf9', '#1565c0', 5); circle(ctx, 285, 260, 18, '#90caf9', '#1565c0', 5); }
  if (frame >= 4) { line(ctx, 510, 225, 600, 205, 7); line(ctx, 530, 215, 620, 235, 7); }
  if (frame >= 5) { line(ctx, 170, 150, 230, 150, 5); line(ctx, 140, 185, 210, 185, 5); }
}

function drawUmbrella(ctx, frame) {
  if (frame >= 1) { ctx.beginPath(); ctx.arc(380, 235, 140, Math.PI, 0); ctx.lineTo(520, 235); ctx.closePath(); ctx.fillStyle = '#64b5f6'; ctx.fill(); ctx.stroke(); }
  if (frame >= 2) { line(ctx, 380, 235, 380, 385, 9); ctx.beginPath(); ctx.arc(380, 390, 35, 0, Math.PI); ctx.stroke(); }
  if (frame >= 3) for (const x of [270, 325, 435, 490]) line(ctx, x, 235, x - 10, 255, 5);
  if (frame >= 4) for (const [x, y] of [[230,300],[295,335],[465,310],[530,295],[580,345]]) { line(ctx, x, y, x - 12, y + 26, 5); line(ctx, x - 12, y + 26, x - 4, y + 38, 5); }
  if (frame >= 5) line(ctx, 120, 410, 640, 410, 7);
}

function drawCamera(ctx, frame) {
  if (frame >= 1) rect(ctx, 205, 180, 350, 205, '#b0bec5', '#455a64', 8, 18);
  if (frame >= 2) { rect(ctx, 290, 145, 90, 40, '#90a4ae', '#455a64', 7, 9); circle(ctx, 380, 280, 72, '#eceff1', '#455a64', 8); circle(ctx, 380, 280, 42, '#90caf9', '#1565c0', 7); }
  if (frame >= 3) circle(ctx, 500, 225, 12, '#ef5350', '#b71c1c', 5);
  if (frame >= 4) { line(ctx, 235, 205, 280, 205, 5); line(ctx, 235, 225, 275, 225, 5); }
  if (frame >= 5) { ctx.beginPath(); ctx.arc(380, 280, 25, 0, Math.PI * 2); ctx.stroke(); }
}

function drawClock(ctx, frame) {
  circle(ctx, 380, 250, 125, '#fffde7', '#5d4037', 8);
  if (frame >= 2) { line(ctx, 380, 250, 380, 175, 8); line(ctx, 380, 250, 445, 280, 8); }
  if (frame >= 3) for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 * i) / 12; line(ctx, 380 + Math.cos(a) * 105, 250 + Math.sin(a) * 105, 380 + Math.cos(a) * 118, 250 + Math.sin(a) * 118, 5); }
  if (frame >= 4) { circle(ctx, 380, 250, 9, '#263238', null, 0); line(ctx, 320, 115, 350, 95, 7); line(ctx, 410, 95, 440, 115, 7); }
  if (frame >= 5) { line(ctx, 240, 395, 520, 395, 6); }
}

function drawGuitar(ctx, frame) {
  if (frame >= 1) { circle(ctx, 360, 300, 72, '#ffb74d', '#8d5524', 8); circle(ctx, 410, 270, 54, '#ffb74d', '#8d5524', 8); }
  if (frame >= 2) { line(ctx, 395, 255, 555, 115, 13); line(ctx, 555, 115, 600, 150, 12); }
  if (frame >= 3) { circle(ctx, 380, 300, 16, '#263238', '#263238', 4); }
  if (frame >= 4) for (const offset of [-6, -2, 2, 6]) line(ctx, 390 + offset, 260, 548 + offset, 118, 2);
  if (frame >= 5) { line(ctx, 600, 150, 610, 110, 6); line(ctx, 610, 110, 635, 120, 6); }
}

function drawRocket(ctx, frame) {
  if (frame >= 1) { ctx.beginPath(); ctx.moveTo(380, 90); ctx.quadraticCurveTo(500, 190, 455, 315); ctx.lineTo(380, 375); ctx.lineTo(305, 315); ctx.quadraticCurveTo(260, 190, 380, 90); ctx.closePath(); ctx.fillStyle = '#eceff1'; ctx.fill(); ctx.stroke(); }
  if (frame >= 2) { circle(ctx, 380, 205, 37, '#90caf9', '#1565c0', 7); }
  if (frame >= 3) { line(ctx, 315, 290, 265, 340, 12); line(ctx, 445, 290, 495, 340, 12); }
  if (frame >= 4) { ctx.beginPath(); ctx.moveTo(345, 365); ctx.lineTo(380, 445); ctx.lineTo(415, 365); ctx.fillStyle = '#ff8a65'; ctx.fill(); ctx.stroke(); }
  if (frame >= 5) { circle(ctx, 115, 100, 4, '#263238', null, 0); circle(ctx, 650, 120, 5, '#263238', null, 0); circle(ctx, 630, 370, 4, '#263238', null, 0); }
}

function drawCrown(ctx, frame) {
  if (frame >= 1) { ctx.beginPath(); ctx.moveTo(210, 170); ctx.lineTo(270, 320); ctx.lineTo(490, 320); ctx.lineTo(550, 170); ctx.lineTo(470, 230); ctx.lineTo(380, 150); ctx.lineTo(290, 230); ctx.closePath(); ctx.fillStyle = '#ffd54f'; ctx.fill(); ctx.stroke(); }
  if (frame >= 2) { circle(ctx, 270, 320, 14, '#ef5350', '#b71c1c', 5); circle(ctx, 380, 320, 14, '#42a5f5', '#1565c0', 5); circle(ctx, 490, 320, 14, '#66bb6a', '#2e7d32', 5); }
  if (frame >= 3) { line(ctx, 280, 345, 480, 345, 10); }
  if (frame >= 5) { circle(ctx, 380, 100, 16, '#ffd54f', '#f9a825', 5); }
}

function drawTrain(ctx, frame) {
  if (frame >= 1) rect(ctx, 150, 205, 430, 145, '#90caf9', '#1565c0', 8, 18);
  if (frame >= 2) { rect(ctx, 185, 235, 90, 70, '#e3f2fd', '#1565c0', 6); rect(ctx, 310, 235, 90, 70, '#e3f2fd', '#1565c0', 6); rect(ctx, 435, 235, 90, 70, '#e3f2fd', '#1565c0', 6); }
  if (frame >= 3) { circle(ctx, 240, 370, 35, '#263238', '#111827', 6); circle(ctx, 490, 370, 35, '#263238', '#111827', 6); }
  if (frame >= 4) { line(ctx, 145, 350, 585, 350, 7); line(ctx, 110, 405, 630, 405, 6); }
  if (frame >= 5) { rect(ctx, 585, 235, 70, 115, '#ffcc80', '#ef6c00', 7); circle(ctx, 620, 380, 10, '#ef5350', '#b71c1c', 5); }
}

function drawCake(ctx, frame) {
  if (frame >= 1) rect(ctx, 250, 250, 260, 125, '#f8bbd0', '#ad1457', 8, 12);
  if (frame >= 2) { rect(ctx, 220, 215, 320, 55, '#fce4ec', '#ad1457', 8, 20); }
  if (frame >= 3) { rect(ctx, 330, 145, 22, 70, '#fff59d', '#f9a825', 5); rect(ctx, 405, 145, 22, 70, '#fff59d', '#f9a825', 5); }
  if (frame >= 4) { line(ctx, 341, 135, 341, 120, 6); line(ctx, 416, 135, 416, 120, 6); }
  if (frame >= 5) { circle(ctx, 341, 112, 6, '#ff7043', null, 0); circle(ctx, 416, 112, 6, '#ff7043', null, 0); line(ctx, 210, 385, 550, 385, 6); }
}

function drawComputer(ctx, frame) {
  if (frame >= 1) rect(ctx, 205, 120, 350, 220, '#b0bec5', '#455a64', 8, 14);
  if (frame >= 2) rect(ctx, 235, 150, 290, 155, '#90caf9', '#1565c0', 7, 8);
  if (frame >= 3) { rect(ctx, 330, 345, 100, 25, '#78909c', '#455a64', 6, 6); rect(ctx, 280, 370, 200, 22, '#90a4ae', '#455a64', 6, 6); }
  if (frame >= 4) { line(ctx, 270, 200, 315, 200, 5); line(ctx, 270, 225, 355, 225, 5); line(ctx, 270, 250, 340, 250, 5); }
  if (frame >= 5) { circle(ctx, 480, 165, 9, '#ef5350', '#b71c1c', 4); circle(ctx, 480, 195, 9, '#ffd54f', '#f9a825', 4); circle(ctx, 480, 225, 9, '#66bb6a', '#2e7d32', 4); }
}

const DRAWERS = {
  sun: drawSun, cat: drawCat, house: drawHouse, ball: drawBall, tree: drawTree, apple: drawApple,
  pizza: drawPizza, car: drawCar, plane: drawPlane, umbrella: drawUmbrella, camera: drawCamera,
  clock: drawClock, guitar: drawGuitar, rocket: drawRocket, crown: drawCrown, train: drawTrain,
  cake: drawCake, computer: drawComputer,
};

async function renderDrawing(word, frame) {
  const { image, ctx } = createCanvas();
  const drawer = DRAWERS[word.draw];
  if (drawer) drawer(ctx, Math.max(1, frame));
  else drawSun(ctx, frame);

  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
  PImage.encodePNGToStream(image, stream).catch(rejectPromise => stream.destroy(rejectPromise));
  return done;
}

function rejectPromise(error) {
  return error;
}

function buildAttachment(buffer) {
  return new AttachmentBuilder(buffer, { name: 'guess-the-draw.png' });
}

function calculateScore(word, elapsedMs) {
  const cap = scoreCap[word.difficulty] || scoreCap.hard;
  const ratio = Math.max(0, Math.min(1, 1 - elapsedMs / (ROUND_SECONDS * 1000)));
  return Math.max(10, Math.round(cap * (0.35 + ratio * 0.65)));
}

function addTotals(state, winnerId, points) {
  state.totals.set(winnerId, (state.totals.get(winnerId) || 0) + points);
  state.roundWins.set(winnerId, (state.roundWins.get(winnerId) || 0) + 1);
}

async function recordStateResults(state) {
  const players = new Set(state.players);
  for (const id of players) {
    recordResult(state.guildId, id, state.roundWins.get(id) || 0, state.totals.get(id) || 0);
  }
}

async function updateRoundMessage(state, word, frame, startedAt, message) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, ROUND_SECONDS - elapsed / 1000);
  const buffer = await renderDrawing(word, frame);
  await message.edit({
    embeds: [drawEmbed(state, word, remaining)],
    files: [buildAttachment(buffer)],
    components: roundButtons(state),
  }).catch(() => {});
  return remaining;
}

async function playRound(state, channel) {
  state.round += 1;
  const word = pickWord(state);
  state.currentWord = word;
  state.hintsUsed = new Set();
  state.roundStartedAt = Date.now();
  const message = state.roundMessage || await channel.send({ embeds: [drawEmbed(state, word, ROUND_SECONDS)], components: roundButtons(state) });
  state.roundMessage = message;

  const schedule = [];
  for (let frame = 1; frame <= FRAME_COUNT; frame++) {
    schedule.push((frame - 1) * FRAME_INTERVAL_MS);
  }
  for (const delay of schedule) {
    const elapsed = Date.now() - state.roundStartedAt;
    const wait = delay - elapsed;
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    if (state.cancelled || state.finished) return false;
    await updateRoundMessage(state, word, Math.min(FRAME_COUNT, Math.floor(delay / FRAME_INTERVAL_MS) + 1), state.roundStartedAt, message);
  }

  await new Promise(resolve => setTimeout(resolve, Math.max(0, ROUND_SECONDS * 1000 - (Date.now() - state.roundStartedAt))));
  if (state.cancelled || state.finished) return false;
  await message.edit({
    embeds: [new EmbedBuilder().setTitle('⏱️ انتهت الجولة').setDescription(`ما تخمناتش الرسمة.\n\n✅ الإجابة كانت: **${word.answer}**`).setImage('attachment://guess-the-draw.png')],
    components: [],
  }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 1200));
  return true;
}

async function runGame(state, channel) {
  try {
    for (let i = 0; i < ROUNDS; i++) {
      if (state.cancelled) return;
      const keepGoing = await playRound(state, channel);
      if (!keepGoing) return;
      if (state.cancelled) return;
    }
  } finally {
    if (!state.finished && !state.cancelled) {
      state.finished = true;
      activeGames.delete(state.channelId);
      await recordStateResults(state);
      const summaryRows = [...state.totals.entries()].map(([userId, points]) => ({ userId, points }));
      await channel.send({ embeds: [finishEmbed(state, summaryRows)] }).catch(() => {});
    }
  }
}

async function startFromState(state, channel) {
  if (state.started || state.cancelled || state.finished) return;
  if (state.players.length < MIN_PLAYERS) return;
  state.started = true;
  clearInterval(state.lobbyTicker);
  clearTimeout(state.lobbyTimeout);
  await state.message?.edit({ embeds: [lobbyEmbed(state, 0)], components: lobbyButtons(state, true) }).catch(() => {});
  const mention = state.settings.startMentionRoleId ? `<@&${state.settings.startMentionRoleId}>` : '';
  if (mention) await channel.send({ content: mention, allowedMentions: { roles: [state.settings.startMentionRoleId] } }).catch(() => {});
  await runGame(state, channel);
}

async function createDrawLobby(source) {
  const guildId = source.guildId;
  const settings = getDrawSettings(guildId);
  const state = {
    id: 'draw',
    key: keygen(),
    guildId,
    channelId: source.channelId,
    hostId: source.user?.id || source.author?.id,
    players: [],
    maxPlayers: settings.maxPlayers,
    settings,
    started: false,
    cancelled: false,
    finished: false,
    round: 0,
    currentWord: null,
    roundStartedAt: 0,
    hintsUsed: new Set(),
    usedAnswers: new Set(),
    totals: new Map(),
    roundWins: new Map(),
    collectors: new Set(),
  };

  activeGames.set(state.channelId, state);
  const total = settings.startSeconds;
  let remaining = total;
  const payload = {
    content: settings.startMentionRoleId ? `<@&${settings.startMentionRoleId}>` : undefined,
    embeds: [lobbyEmbed(state, remaining)],
    components: lobbyButtons(state),
    allowedMentions: settings.startMentionRoleId ? { roles: [settings.startMentionRoleId] } : { parse: [] },
  };
  state.message = source.isChatInputCommand?.() ? (await source.reply(payload), await source.fetchReply().catch(() => null)) : await source.channel.send(payload).catch(() => null);
  if (!state.message) { activeGames.delete(state.channelId); return; }

  state.lobbyTicker = setInterval(async () => {
    if (state.started || state.cancelled || state.finished) return;
    remaining -= 1;
    await state.message.edit({ embeds: [lobbyEmbed(state, remaining)], components: lobbyButtons(state) }).catch(() => {});
  }, 1000);
  state.lobbyTimeout = setTimeout(() => {
    if (state.players.length >= MIN_PLAYERS) startFromState(state, state.message.channel).catch(console.error);
    else {
      state.cancelled = true;
      activeGames.delete(state.channelId);
      clearInterval(state.lobbyTicker);
      state.message.edit({ embeds: [lobbyEmbed(state, 0).setDescription(`${lobbyEmbed(state, 0).data.description}\n\n⏱️ انتهى الوقت قبل الوصول إلى **${MIN_PLAYERS} لاعبين**.`)], components: [] }).catch(() => {});
    }
  }, settings.startSeconds * 1000);

  return state;
}

function findState(channelId, key) {
  const state = activeGames.get(channelId);
  return state && state.key === key ? state : null;
}

export async function startDrawGame(source) {
  if (!source.guildId || !source.channelId) return false;
  if (activeGames.has(source.channelId)) {
    const responder = source.reply || source.channel?.send;
    if (source.isChatInputCommand?.()) await source.reply({ content: '⚠️ كاينة لعبة أو فعالية خدامة دابا فهاد الروم.', ephemeral: true }).catch(() => {});
    else await source.reply('⚠️ كاينة لعبة أو فعالية خدامة دابا فهاد الروم.').catch(() => {});
    return false;
  }
  return createDrawLobby(source).then(() => true);
}

export async function handleDrawButton(interaction) {
  const parts = interaction.customId.split(':');
  if (parts[0] === 'drawlobby') {
    const [, key, action] = parts;
    const state = findState(interaction.channelId, key);
    if (!state) return interaction.reply({ content: 'انتهى هذا الـLobby أو لم يعد موجوداً.', ephemeral: true }).catch(() => {});
    if (state.started || state.cancelled || state.finished) return interaction.reply({ content: 'هاد الجولة بدات، ما بقاتش تعديلات على الـLobby.', ephemeral: true }).catch(() => {});

    if (action === 'join') {
      if (state.players.includes(interaction.user.id)) return interaction.reply({ content: '✅ راك منضم أصلاً.', ephemeral: true }).catch(() => {});
      if (state.players.length >= state.maxPlayers) return interaction.reply({ content: '🚫 وصلنا للحد الأقصى ديال اللاعبين.', ephemeral: true }).catch(() => {});
      state.players.push(interaction.user.id);
      await interaction.update({ embeds: [lobbyEmbed(state, 0)], components: lobbyButtons(state) }).catch(() => {});
      return;
    }

    if (action === 'leave') {
      state.players = state.players.filter(id => id !== interaction.user.id);
      return interaction.update({ embeds: [lobbyEmbed(state, 0)], components: lobbyButtons(state) }).catch(() => {});
    }

    if (action === 'start') {
      if (interaction.user.id !== state.hostId && !interaction.member?.permissions?.has('ManageGuild') && !interaction.member?.permissions?.has('Administrator')) {
        return interaction.reply({ content: '⛔ غير منظم الفعالية أو الإدارة يقدرو يبداوها يدوياً.', ephemeral: true }).catch(() => {});
      }
      if (state.players.length < MIN_PLAYERS) return interaction.reply({ content: `⚠️ خاص على الأقل ${MIN_PLAYERS} لاعبين.`, ephemeral: true }).catch(() => {});
      await interaction.deferUpdate().catch(() => {});
      return startFromState(state, interaction.channel);
    }

    if (action === 'cancel') {
      if (interaction.user.id !== state.hostId && !interaction.member?.permissions?.has('ManageGuild') && !interaction.member?.permissions?.has('Administrator')) {
        return interaction.reply({ content: '⛔ غير المنظم أو الإدارة يقدرو يلغيو الفعالية.', ephemeral: true }).catch(() => {});
      }
      state.cancelled = true;
      clearInterval(state.lobbyTicker);
      clearTimeout(state.lobbyTimeout);
      activeGames.delete(state.channelId);
      return interaction.update({ embeds: [new EmbedBuilder().setTitle('🛑 خمّن الرسمة تلغات').setDescription('تم إلغاء الـLobby قبل البداية.')], components: [] }).catch(() => {});
    }
  }

  if (parts[0] !== 'draw') return false;
  const [, key, action] = parts;
  const state = findState(interaction.channelId, key);
  if (!state || state.finished || state.cancelled || !state.started || !state.currentWord) return interaction.reply({ content: 'هاد الجولة سالات.', ephemeral: true }).catch(() => {});
  if (action !== 'hint') return false;
  if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: '👥 غير اللاعبين ديال الفعالية عندهم التلميح.', ephemeral: true }).catch(() => {});
  if (state.hintsUsed.has(interaction.user.id)) return interaction.reply({ content: '💡 استعملتي التلميح ديالك من قبل فهاد الجولة.', ephemeral: true }).catch(() => {});

  state.hintsUsed.add(interaction.user.id);
  const pattern = revealLetters(state.currentWord.answer, 2);
  return interaction.reply({ content: `💡 التلميح ديالك (خاص بيك بوحدك):\n**${pattern}**\n\nعندك فرصة أخرى تخمن من بعد.`, ephemeral: true }).catch(() => {});
}

export async function handleDrawMessage(message) {
  const state = findState(message.channelId, null);
  if (!state || !state.started || state.finished || state.cancelled || !state.currentWord || message.author.bot) return false;
  if (!state.players.includes(message.author.id)) return false;

  const guess = normalize(message.content);
  const accepted = state.currentWord.aliases.some(alias => normalize(alias) === guess);
  if (!accepted) return false;

  const elapsed = Date.now() - state.roundStartedAt;
  const points = calculateScore(state.currentWord, elapsed);
  state.currentWinner = message.author.id;
  addTotals(state, message.author.id, points);
  await message.channel.send({ embeds: [new EmbedBuilder().setTitle('🎯 إجابة صحيحة!').setDescription(`🏆 ${message.author} خمنها صح!\n\n✅ الكلمة: **${state.currentWord.answer}**\n⚡ النقاط: **+${points}**\n\nالجولة سالات مباشرة.`)] }).catch(() => {});
  await state.roundMessage?.edit({ components: [] }).catch(() => {});
  return true;
}

export async function stopDrawState(state) {
  if (!state) return false;
  state.cancelled = true;
  state.finished = true;
  clearInterval(state.lobbyTicker);
  clearTimeout(state.lobbyTimeout);
  activeGames.delete(state.channelId);
  await recordStateResults(state);
  return true;
}
