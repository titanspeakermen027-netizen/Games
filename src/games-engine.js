import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { recordGame } from './store.js';

export const activeGames = new Map();
const MAX_PLAYERS = 20;
const MIN_PLAYERS = 2;

const NAMES = {
  xo: 'XO', mafia: 'مافيا', chairs: 'كراسي', rps: 'حجرة ورقة مقص', dice: 'نرد', hotxo: 'HotXO',
  hide: 'غميضة', replica: 'ريبلكا', country: 'خمّن الدولة', draw: 'خمّن الرسمة', word: 'خمّن الكلمة',
  wheel: 'العجلة', button: 'زر', fast: 'أسرع', split: 'فكك', merge: 'ادمج', flag: 'أعلام', reverse: 'اعكس',
  letter: 'حرف', correct: 'صحح', sort: 'ترتيب', colors: 'ألوان', emoji: 'إيموجي', reveal: 'اكشف'
};

const SERVER_GAMES = new Set(['xo','mafia','chairs','rps','dice','hotxo','hide','replica','country','draw','word','wheel']);
const MINI_GAMES = new Set(['button','fast','split','merge','flag','reverse','letter','correct','sort','colors','emoji','reveal']);
const random = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const mention = ids => ids.map(id => `<@${id}>`).join('، ');
const token = () => Math.random().toString(36).slice(2, 8);

function lobbyComponents(gameId, key, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lobby:${key}:join`).setLabel('انضمام').setEmoji('🎮').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`lobby:${key}:start`).setLabel('بدء').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`lobby:${key}:cancel`).setLabel('إلغاء').setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(disabled)
  )];
}

function lobbyEmbed(state) {
  return new EmbedBuilder()
    .setTitle(`🎮 ${NAMES[state.id]}`)
    .setDescription(`انضم بالضغط على **انضمام**، ثم اضغط **بدء** عند اكتمال المجموعة.\n\n**اللاعبون (${state.players.length}/${MAX_PLAYERS}):**\n${state.players.length ? state.players.map(id => `• <@${id}>`).join('\n') : 'لا يوجد لاعبون بعد.'}`)
    .setFooter({ text: 'الحد الأدنى لاعبان • يبدأ تلقائيًا بعد 30 ثانية عند توفر الحد الأدنى' });
}

function rememberCollector(state, collector) {
  state.collectors ??= new Set();
  state.collectors.add(collector);
  collector.once('end', () => state.collectors.delete(collector));
  return collector;
}

function stopCollectors(state) {
  for (const collector of state.collectors ?? []) collector.stop('cancelled');
  state.collectors?.clear();
}

async function finish(state, channel, winners = [], reason = null) {
  if (state.finished) return;
  state.finished = true;
  stopCollectors(state);
  activeGames.delete(state.channelId);
  const text = reason || (winners.length ? `🏆 الفائز: ${mention(winners)}` : '⏱️ انتهت اللعبة بلا فائز.');
  await channel.send({ embeds: [new EmbedBuilder().setTitle(`🏁 ${NAMES[state.id]} انتهت`).setDescription(text)] }).catch(() => {});
  for (const id of state.players) recordGame(state.guildId, id, winners.includes(id), winners.includes(id) ? 10 : 0);
}

function requiredPlayers(gameId) {
  if (gameId === 'mafia') return 4;
  if (gameId === 'chairs') return 3;
  return MIN_PLAYERS;
}

export async function handleGameCommand(interaction, gameId) {
  if (!SERVER_GAMES.has(gameId) && !MINI_GAMES.has(gameId)) {
    return interaction.reply({ content: 'هذه اللعبة غير متاحة.', ephemeral: true });
  }
  if (SERVER_GAMES.has(gameId)) {
    if (activeGames.has(interaction.channelId)) return interaction.reply({ content: 'توجد لعبة نشطة بالفعل في هذه القناة.', ephemeral: true });
    return createLobby(interaction, gameId);
  }
  if (activeGames.has(interaction.channelId)) return interaction.reply({ content: 'توجد لعبة نشطة بالفعل في هذه القناة.', ephemeral: true });
  return startMini(interaction, gameId);
}

async function createLobby(interaction, gameId) {
  const key = token();
  const state = {
    id: gameId, key, guildId: interaction.guildId, channelId: interaction.channelId,
    players: [], started: false, cancelled: false, finished: false, collectors: new Set(),
  };
  activeGames.set(interaction.channelId, state);
  await interaction.reply({ embeds: [lobbyEmbed(state)], components: lobbyComponents(gameId, key) });
  state.message = await interaction.fetchReply();
  state.timeout = setTimeout(() => autoStart(state).catch(console.error), 30000);
}

async function autoStart(state) {
  if (state.finished || state.cancelled || state.started || !activeGames.has(state.channelId)) return;
  if (state.players.length < requiredPlayers(state.id)) {
    activeGames.delete(state.channelId);
    clearTimeout(state.timeout);
    await state.message.edit({ embeds: [lobbyEmbed(state).setDescription(`${lobbyEmbed(state).data.description}\n\n⏱️ انتهى الوقت قبل اكتمال الحد الأدنى.`)], components: [] }).catch(() => {});
    return;
  }
  state.started = true;
  clearTimeout(state.timeout);
  await state.message.edit({ components: lobbyComponents(state.id, state.key, true) }).catch(() => {});
  await launch(state, state.message.channel);
}

async function launch(state, channel) {
  try {
    switch (state.id) {
      case 'xo': return playXO(channel, state, false);
      case 'hotxo': return playXO(channel, state, true);
      case 'rps': return playRPS(channel, state);
      case 'dice': return playDice(channel, state);
      case 'chairs': return playChairs(channel, state);
      case 'mafia': return playMafia(channel, state);
      case 'hide': return playHide(channel, state);
      case 'replica': return playText(channel, state, 'ريبلكا', ['مغرب','مدينة','مدرسة','سيارة','برمجة'], 'أعد الكلمة الظاهرة بسرعة.');
      case 'country': return playText(channel, state, 'خمّن الدولة', ['المغرب','اليابان','فرنسا','البرازيل','مصر','كندا'], 'ما اسم الدولة؟');
      case 'draw': return playText(channel, state, 'خمّن الرسمة', ['☀️ شمس','🐱 قطة','🏠 بيت','⚽ كرة','🚗 سيارة'], 'خمّن الرسمة من الإيموجي.');
      case 'word': return playText(channel, state, 'خمّن الكلمة', ['مكتبة','مغامرة','بطولة','حاسوب','مستقبل','لعبة'], 'خمّن الكلمة المخفية.');
      case 'wheel': return playWheel(channel, state);
      default: return finish(state, channel, [], 'هذه اللعبة غير متوفرة حاليًا.');
    }
  } catch (error) {
    console.error(`[${state.id}]`, error);
    await finish(state, channel, [], 'حدث خطأ أثناء تشغيل اللعبة، وتم إنهاؤها بأمان.');
  }
}

async function playXO(channel, state, hot) {
  let players = shuffle(state.players);
  while (players.length > 1 && !state.cancelled) {
    const next = [];
    for (let i = 0; i < players.length; i += 2) {
      if (!players[i + 1]) { next.push(players[i]); continue; }
      const a = players[i], b = players[i + 1];
      const board = Array(9).fill(null);
      let turn = 0;
      let roundsMoves = 0;
      const msg = await channel.send({ embeds: [xoEmbed(a, b, board, turn)], components: xoRows(board, true) });
      let gameOver = false;
      while (!gameOver && !state.cancelled) {
        const move = await waitForMove(state, msg, board, turn ? b : a);
        if (!move) { next.push(turn ? b : a); break; }
        board[move] = turn ? '⭕' : '❌';
        roundsMoves++;
        const win = winner(board);
        if (win || (!hot && board.every(Boolean))) {
          gameOver = true;
          const roundWinner = win ? (turn ? b : a) : random([a, b]);
          next.push(roundWinner);
          await msg.edit({ embeds: [xoEmbed(a, b, board, turn, true)], components: xoRows(board, false) }).catch(() => {});
        } else {
          if (hot && roundsMoves >= 6) {
            const own = turn ? '⭕' : '❌';
            const remove = board.findIndex(cell => cell === own);
            if (remove >= 0) board[remove] = null;
          }
          turn ^= 1;
          await msg.edit({ embeds: [xoEmbed(a, b, board, turn)], components: xoRows(board, true) }).catch(() => {});
        }
      }
    }
    players = shuffle(next);
  }
  if (!state.cancelled && players[0]) await finish(state, channel, [players[0]]);
  else if (!state.finished) await finish(state, channel, [], 'تم إلغاء اللعبة.');
}

function xoRows(board, enabled) {
  return [0,1,2].map(row => new ActionRowBuilder().addComponents(
    [0,1,2].map(col => {
      const index = row * 3 + col;
      return new ButtonBuilder().setCustomId(`xo:${index}`).setLabel(board[index] || '·').setStyle(board[index] ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(Boolean(board[index]) || !enabled);
    })
  ));
}

function xoEmbed(a, b, board, turn, done = false) {
  const current = turn ? b : a;
  return new EmbedBuilder().setTitle('⭕ XO ❌').setDescription(`الدور: <@${current}>\n\n${board.map((v, i) => `${v || '▫️'}${i % 3 === 2 ? '\n' : ' '}`).join('')}${done ? '\n🏁 انتهت الجولة.' : ''}`);
}

function winner(board) {
  for (const [a, b, c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

async function waitForMove(state, message, board, userId) {
  return new Promise(resolve => {
    const collector = rememberCollector(state, message.createMessageComponentCollector({ time: 15000 }));
    let settled = false;
    const done = value => { if (!settled) { settled = true; resolve(value); } };
    collector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: 'ليس دورك الآن.', ephemeral: true }).catch(() => {});
      const index = Number(interaction.customId.split(':')[1]);
      if (!Number.isInteger(index) || board[index]) return interaction.reply({ content: 'هذه الخانة غير متاحة.', ephemeral: true }).catch(() => {});
      await interaction.deferUpdate().catch(() => {});
      collector.stop('move');
      done(index);
    });
    collector.once('end', (_, reason) => { if (reason !== 'move') done(null); });
  });
}

function rpsResult(values) {
  const present = new Set(values);
  if (present.size <= 1 || present.size === 3) return null;
  if (present.has(0) && present.has(2)) return 0;
  if (present.has(0) && present.has(1)) return 1;
  return 2;
}

async function playRPS(channel, state) {
  let alive = [...state.players];
  while (alive.length > 1 && !state.cancelled) {
    const picks = new Map();
    const message = await channel.send({ content: '✊ **حجرة ورقة مقص** — اختار بسرعة!', components: [new ActionRowBuilder().addComponents(
      ['حجرة','ورقة','مقص'].map((label, value) => new ButtonBuilder().setCustomId(`rps:${value}`).setLabel(label).setStyle(ButtonStyle.Primary))
    )] });
    const collector = rememberCollector(state, message.createMessageComponentCollector({ time: 12000 }));
    collector.on('collect', async i => {
      if (!alive.includes(i.user.id)) return i.reply({ content: 'أنت خارج هذه الجولة.', ephemeral: true }).catch(() => {});
      picks.set(i.user.id, Number(i.customId.split(':')[1]));
      await i.reply({ content: 'تم تسجيل اختيارك ✅', ephemeral: true }).catch(() => {});
      if (picks.size >= alive.length) collector.stop('full');
    });
    await new Promise(resolve => collector.once('end', resolve));
    if (!picks.size) { alive = [random(alive)]; break; }
    for (const id of alive) if (!picks.has(id)) picks.set(id, Math.floor(Math.random() * 3));
    const winningValue = rpsResult([...picks.values()]);
    if (winningValue === null) {
      await channel.send('🤝 تعادل — نعيد الجولة.');
      continue;
    }
    alive = alive.filter(id => picks.get(id) === winningValue);
    if (alive.length > 1) await channel.send(`⭐ المتبقون: ${mention(alive)}`);
  }
  await finish(state, channel, alive[0] ? [alive[0]] : []);
}

async function playDice(channel, state) {
  const teams = [[], []];
  shuffle(state.players).forEach((id, index) => teams[index % 2].push(id));
  const scores = [0, 0];
  for (let round = 1; round <= 3 && !state.cancelled; round++) {
    const a = 1 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * 6);
    scores[0] += a; scores[1] += b;
    await channel.send(`🎲 الجولة ${round}: الفريق الأول **${a}** — الفريق الثاني **${b}**\nالمجموع: **${scores[0]} - ${scores[1]}**`);
    await wait(500);
  }
  const winners = scores[0] === scores[1] ? shuffle(state.players).slice(0, 1) : teams[scores[0] > scores[1] ? 0 : 1];
  await finish(state, channel, winners);
}

async function playChairs(channel, state) {
  let players = shuffle(state.players);
  while (players.length > 1 && !state.cancelled) {
    const seats = players.length - 1;
    const taken = new Set();
    const message = await channel.send({ content: `🪑 **الكراسي**\nهناك **${seats}** مقاعد فقط — الأسرع يبقى!`, components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`chair:${state.key}`).setLabel('اجلس').setEmoji('🪑').setStyle(ButtonStyle.Success)
    )] });
    const collector = rememberCollector(state, message.createMessageComponentCollector({ time: 10000 }));
    collector.on('collect', async i => {
      if (!players.includes(i.user.id)) return i.reply({ content: 'أنت خارج الجولة.', ephemeral: true }).catch(() => {});
      if (taken.has(i.user.id)) return i.reply({ content: 'لقد حجزت بالفعل.', ephemeral: true }).catch(() => {});
      if (taken.size >= seats) return i.reply({ content: 'امتلأت المقاعد.', ephemeral: true }).catch(() => {});
      taken.add(i.user.id);
      await i.reply({ content: '🪑 تم حجز مقعدك!', ephemeral: true }).catch(() => {});
      if (taken.size === seats) collector.stop('full');
    });
    await new Promise(resolve => collector.once('end', resolve));
    const eliminated = random(players.filter(id => !taken.has(id)) || players);
    players = players.filter(id => id !== eliminated);
    await channel.send(`💥 خرج <@${eliminated}>. المتبقون: ${mention(players)}`);
  }
  await finish(state, channel, players[0] ? [players[0]] : []);
}

async function playMafia(channel, state) {
  const players = shuffle(state.players);
  const mafiaCount = Math.max(1, Math.floor(players.length / 4));
  const mafia = new Set(players.slice(0, mafiaCount));
  const roles = new Map(players.map(id => [id, mafia.has(id) ? 'مافيا' : 'مواطن']));
  for (const [id, role] of roles) {
    const member = await channel.guild.members.fetch(id).catch(() => null);
    await member?.send(`🎭 دورك في لعبة **مافيا**: **${role}**\nلا تشارك دورك مع اللاعبين.`).catch(() => {});
  }
  let alive = [...players];
  while (alive.length > 2 && !state.cancelled) {
    await channel.send({ embeds: [new EmbedBuilder().setTitle('🌙 ليلة المافيا').setDescription('يتم اختيار ضحية عشوائية من الأحياء خارج المافيا في هذه النسخة.')] });
    await wait(5000);
    const target = random(alive.filter(id => !mafia.has(id)));
    if (target) {
      alive = alive.filter(id => id !== target);
      await channel.send(`☀️ خرج <@${target}> من اللعبة.`);
    }
    const mafiaAlive = alive.filter(id => mafia.has(id));
    const townAlive = alive.filter(id => !mafia.has(id));
    if (!townAlive.length || mafiaAlive.length >= townAlive.length) break;
    const voteTarget = random(alive);
    alive = alive.filter(id => id !== voteTarget);
    await channel.send(`🗳️ بعد التصويت، خرج <@${voteTarget}>.`);
  }
  const mafiaAlive = alive.filter(id => mafia.has(id));
  const townAlive = alive.filter(id => !mafia.has(id));
  const mafiaWon = mafiaAlive.length >= townAlive.length;
  await finish(state, channel, alive.filter(id => mafia.has(id) === mafiaWon));
}

async function playHide(channel, state) {
  const seeker = random(state.players);
  const hiders = state.players.filter(id => id !== seeker);
  await channel.send(`🙈 **غميضة**\nالباحث: <@${seeker}>\nلدى المختبئين 8 ثوانٍ قبل البحث...`);
  await wait(8000);
  const foundCount = Math.min(hiders.length, Math.floor(hiders.length / 2));
  const found = shuffle(hiders).slice(0, foundCount);
  const survivors = hiders.filter(id => !found.includes(id));
  await channel.send(`🔎 وجد الباحث: ${found.length ? mention(found) : 'لا أحد'}\n🫥 بقي مختبئًا: ${survivors.length ? mention(survivors) : 'لا أحد'}`);
  await finish(state, channel, survivors.length ? survivors : [seeker]);
}

async function playText(channel, state, title, pool, instruction) {
  const answer = random(pool);
  const message = await channel.send(`🧠 **${title}**\n${instruction}\n\nابدأ الآن!`);
  const collector = rememberCollector(state, channel.createMessageCollector({
    time: 15000,
    filter: m => !m.author.bot && state.players.includes(m.author.id)
  }));
  let winnerId = null;
  collector.on('collect', m => {
    if (m.content.trim().toLowerCase() === answer.toLowerCase()) { winnerId = m.author.id; collector.stop('correct'); }
  });
  await new Promise(resolve => collector.once('end', resolve));
  await message.edit(`🧠 **${title}**\nالإجابة: **${answer}**\n${winnerId ? `🏆 <@${winnerId}> أجاب بشكل صحيح!` : '⏱️ انتهى الوقت.'}`).catch(() => {});
  await finish(state, channel, winnerId ? [winnerId] : []);
}

async function playWheel(channel, state) {
  const winner = random(state.players);
  const frames = ['🎡  جاري الدوران...', '🎡  🔄 الدوران...', '🎡  🔄🔄 الدوران...', '🎡  🔄🔄🔄 الدوران...'];
  const message = await channel.send(frames[0]);
  for (const frame of frames.slice(1)) { await wait(700); await message.edit(frame).catch(() => {}); }
  await message.edit(`🎡 توقفت العجلة!\n\n🏆 النتيجة: <@${winner}>`).catch(() => {});
  await finish(state, channel, [winner]);
}

async function startMini(interaction, gameId) {
  const key = token();
  const state = { id: gameId, key, guildId: interaction.guildId, channelId: interaction.channelId, players: [], started: true, collectors: new Set(), finished: false };
  activeGames.set(interaction.channelId, state);
  try {
    await miniRunner(interaction, state);
  } catch (error) {
    console.error(`[mini:${gameId}]`, error);
    await finish(state, interaction.channel, [], 'حدث خطأ أثناء تشغيل اللعبة.');
  }
}

const MINI = {
  fast: { prompt: 'اكتب **برق** بأسرع ما يمكن.', answer: 'برق' },
  split: { prompt: 'فكك الكلمة: **مـكـتـبـة**', answer: 'مكتبة' },
  merge: { prompt: 'ادمج: **ب ر م ج ة**', answer: 'برمجة' },
  flag: { prompt: '🚩 ما الدولة التي يمثلها هذا العلم؟ 🇲🇦', answer: 'المغرب' },
  reverse: { prompt: 'اعكس: **Discord**', answer: 'drocsiD' },
  letter: { prompt: 'أكمل الكلمة: **مـدـرـسـ_**', answer: 'ة' },
  correct: { prompt: 'صحح: **مكتبه**', answer: 'مكتبة' },
  sort: { prompt: 'رتب الأرقام: **3 1 5 2 4**', answer: '1 2 3 4 5' },
  colors: { prompt: 'اكتب اللون: 🔵', answer: 'أزرق' },
  emoji: { prompt: 'أرسل هذا الإيموجي: **🌹**', answer: '🌹' },
  reveal: { prompt: 'اكشف الكلمة: **قـ _ ـب**', answer: 'قلب' },
};

async function miniRunner(interaction, state) {
  if (state.id === 'button') {
    await interaction.reply({ content: '👆 اضغط الزر أسرع من الجميع!', components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mini-hit:${state.key}`).setLabel('اضغط!').setStyle(ButtonStyle.Success)
    )] });
    const message = await interaction.fetchReply();
    const collector = rememberCollector(state, message.createMessageComponentCollector({ time: 10000, max: 1 }));
    let winnerId = null;
    collector.on('collect', async i => { winnerId = i.user.id; await i.reply({ content: '🏆 فزت!', ephemeral: true }).catch(() => {}); });
    await new Promise(resolve => collector.once('end', resolve));
    await finish(state, interaction.channel, winnerId ? [winnerId] : []);
    return;
  }
  const config = MINI[state.id];
  if (!config) { activeGames.delete(state.channelId); return; }
  await interaction.reply(`🎯 **${NAMES[state.id]}**\n${config.prompt}`);
  const collector = rememberCollector(state, interaction.channel.createMessageCollector({ time: 12000, filter: m => !m.author.bot }));
  let winnerId = null;
  collector.on('collect', m => { if (m.content.trim().toLowerCase() === config.answer.toLowerCase()) { winnerId = m.author.id; collector.stop('correct'); } });
  await new Promise(resolve => collector.once('end', resolve));
  await interaction.channel.send(winnerId ? `🏆 <@${winnerId}> فاز في **${NAMES[state.id]}**!` : `⏱️ انتهى وقت **${NAMES[state.id]}**.`);
  if (winnerId) recordGame(state.guildId, winnerId, true, 3);
  state.finished = true; activeGames.delete(state.channelId); stopCollectors(state);
}

export async function handleButton(interaction) {
  const [type, key, action] = interaction.customId.split(':');

  if (type === 'lobby') {
    const state = activeGames.get(interaction.channelId);
    if (!state || state.key !== key || state.started) return interaction.reply({ content: 'هذا اللوبي انتهى أو بدأت لعبته.', ephemeral: true }).catch(() => {});
    if (action === 'join') {
      if (state.players.includes(interaction.user.id)) return interaction.reply({ content: 'أنت منضم بالفعل.', ephemeral: true });
      if (state.players.length >= MAX_PLAYERS) return interaction.reply({ content: 'اكتمل اللوبي.', ephemeral: true });
      state.players.push(interaction.user.id);
      await interaction.update({ embeds: [lobbyEmbed(state)], components: lobbyComponents(state.id, state.key) });
      return;
    }
    if (action === 'start') {
      const need = requiredPlayers(state.id);
      if (state.players.length < need) return interaction.reply({ content: `تحتاج هذه اللعبة إلى ${need} لاعبين على الأقل.`, ephemeral: true });
      state.started = true; clearTimeout(state.timeout);
      await interaction.update({ embeds: [lobbyEmbed(state)], components: lobbyComponents(state.id, state.key, true) });
      await launch(state, interaction.channel);
      return;
    }
    state.cancelled = true;
    clearTimeout(state.timeout);
    stopCollectors(state);
    activeGames.delete(state.channelId);
    await interaction.update({ content: '✖️ تم إلغاء اللعبة.', embeds: [], components: [] }).catch(() => {});
    return;
  }

  if (type === 'xo' || type === 'rps' || type === 'chair' || type === 'mini-hit') {
    // Gameplay collectors handle these interactions directly; this branch intentionally does nothing.
    return;
  }
}

export async function cancelActiveGame(channelId) {
  const state = activeGames.get(channelId);
  if (!state) return false;
  state.cancelled = true;
  clearTimeout(state.timeout);
  stopCollectors(state);
  activeGames.delete(channelId);
  try { await state.message?.edit({ components: [] }); } catch {}
  return true;
}

export async function handleModal() {
  // Reserved for future modal-based games.
}
