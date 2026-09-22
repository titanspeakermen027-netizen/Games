import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { getGuildSettings, recordGame, isGroupGameChannelAllowed } from './store.js';

export const activeGames = new Map();

export const GROUP_GAMES = new Set([
  'xo', 'mafia', 'chairs', 'rps', 'dice', 'hotxo', 'hide', 'race',
  'replica', 'country', 'draw', 'word', 'wheel',
]);

export const SOLO_GAMES = new Set([
  'button', 'fast', 'split', 'merge', 'flag', 'reverse', 'letter',
  'correct', 'sort', 'colors', 'emoji', 'reveal',
]);

export const GAME_NAMES = {
  xo: 'XO', mafia: 'مافيا', chairs: 'كراسي', rps: 'حجرة ورقة مقص', dice: 'نرد', hotxo: 'HotXO',
  hide: 'غميضة', replica: 'ريبلكا', country: 'خمّن الدولة', draw: 'خمّن الرسمة', word: 'خمّن الكلمة',
  wheel: 'روليت', race: 'سباق', button: 'زر', fast: 'أسرع', split: 'فكك', merge: 'ادمج', flag: 'أعلام', reverse: 'اعكس',
  letter: 'حرف', correct: 'صحح', sort: 'ترتيب', colors: 'ألوان', emoji: 'إيموجي', reveal: 'اكشف',
};

export const PREFIX_ALIASES = {
  group: {
    '-xo': 'xo', '-إكسو': 'xo', '-مافيا': 'mafia', '-كراسي': 'chairs', '-حجرة': 'rps',
    '-حجرةورقةمقص': 'rps', '-نرد': 'dice', '-hotxo': 'hotxo', '-غميضة': 'hide',
    '-ريبلكا': 'replica', '-دولة': 'country', '-رسمة': 'draw', '-كلمة': 'word', '-روليت': 'wheel', '-سباق': 'race',
  },
  solo: {
    '.زر': 'button', '.button': 'button', '.اسرع': 'fast', '.أسرع': 'fast', '.فكك': 'split', '.ادمج': 'merge',
    '.اعلام': 'flag', '.أعلام': 'flag', '.اعكس': 'reverse', '.حرف': 'letter', '.صحح': 'correct',
    '.ترتيب': 'sort', '.الوان': 'colors', '.ألوان': 'colors', '.ايموجي': 'emoji', '.إيموجي': 'emoji',
    '.اكشف': 'reveal',
    '-زر': 'button', '-اسرع': 'fast', '-أسرع': 'fast', '-فكك': 'split', '-ادمج': 'merge',
    '-اعلام': 'flag', '-أعلام': 'flag', '-اعكس': 'reverse', '-حرف': 'letter', '-صحح': 'correct',
    '-ترتيب': 'sort', '-لون': 'colors', '-الوان': 'colors', '-ألوان': 'colors', '-ايموجي': 'emoji', '-إيموجي': 'emoji',
    '-اكشف': 'reveal', '-فاستكليك': 'button', '-fastclick': 'button', '-فاستتايب': 'fast', '-fasttype': 'fast',
    '-تكستسبليت': 'split', '-textsplit': 'split', '-ميرجتكست': 'merge', '-mergetext': 'merge',
    '-خمنالعلم': 'flag', '-guessflag': 'flag', '-ريكفرس': 'reverse', '-textreverse': 'reverse',
    '-صححالحرف': 'correct', '-correctletter': 'correct', '-رتبالارقام': 'sort', '-sortnumbers': 'sort',
    '-خمناللون': 'colors', '-guesscolor': 'colors', '-خمنالايموجي': 'emoji', '-findemoji': 'emoji',
    '-اكشفالكلمة': 'reveal', '-textreveal': 'reveal',
  },
};

const GROUP_STOP = '-توقيف';
const random = array => array[Math.floor(Math.random() * array.length)];
const shuffle = array => [...array].sort(() => Math.random() - 0.5);
const mention = ids => ids.map(id => `<@${id}>`).join('، ');
const keygen = () => Math.random().toString(36).slice(2, 9);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function isEventManager(member, settings) {
  if (!member) return false;
  if (member.permissions?.has('Administrator') || member.permissions?.has('ManageGuild')) return true;
  return Boolean(settings.eventRoleId && member.roles?.cache?.has(settings.eventRoleId));
}

export function canRunGroup(member, settings) {
  return isEventManager(member, settings);
}

function minPlayers(gameId) {
  if (gameId === 'mafia') return 4;
  if (gameId === 'chairs' || gameId === 'race') return 3;
  return 2;
}

function newGroupState(source, gameId) {
  const settings = getGuildSettings(source.guildId);
  return {
    id: gameId,
    key: keygen(),
    guildId: source.guildId,
    channelId: source.channelId,
    hostId: source.user?.id || source.author?.id,
    players: [],
    maxPlayers: settings.maxPlayers,
    lobbySeconds: settings.lobbySeconds,
    winnerPoints: settings.winnerPoints,
    started: false,
    cancelled: false,
    finished: false,
    collectors: new Set(),
  };
}

function rememberCollector(state, collector) {
  state.collectors.add(collector);
  collector.once('end', () => state.collectors.delete(collector));
  return collector;
}

function stopCollectors(state) {
  for (const collector of state.collectors || []) {
    try { collector.stop('cancelled'); } catch {}
  }
  state.collectors?.clear();
}

function lobbyComponents(state, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lobby:${state.key}:join`).setLabel('انضمام').setEmoji('🎮').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`lobby:${state.key}:start`).setLabel('بدء').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`lobby:${state.key}:cancel`).setLabel('إلغاء').setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  )];
}

function lobbyEmbed(state) {
  return new EmbedBuilder()
    .setTitle(`🎮 فعالية ${GAME_NAMES[state.id]}`)
    .setDescription([
      `منظم الفعالية: <@${state.hostId}>`,
      '',
      `**اللاعبون (${state.players.length}/${state.maxPlayers}):**`,
      state.players.length ? state.players.map(id => `• <@${id}>`).join('\n') : '• لا يوجد لاعبون بعد.',
      '',
      `الحد الأدنى: **${minPlayers(state.id)}**`,
      `الفائز: **${state.winnerPoints} نقطة**`,
    ].join('\n'))
    .setFooter({ text: `تبدأ تلقائياً بعد ${state.lobbySeconds} ثانية عند اكتمال الحد الأدنى • أو اضغط «بدء»` });
}

async function safeReply(interaction, payload) {
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

export async function startGroupGame(source, gameId) {
  if (!GROUP_GAMES.has(gameId)) {
    return safeReply(source, { content: '❌ هذه الفعالية غير متاحة حالياً.', ephemeral: true });
  }
  if (activeGames.has(source.channelId)) {
    return safeReply(source, { content: '⚠️ توجد لعبة أو فعالية نشطة في هذه القناة.', ephemeral: true });
  }

  const settings = getGuildSettings(source.guildId);
  if (!canRunGroup(source.member || source.user?.member || source.guild?.members?.cache?.get(source.user?.id || source.author?.id), settings)) {
    return safeReply(source, { content: '⛔ الألعاب الجماعية هي فعاليات، وتحتاج صلاحية الإدارة أو رتبة رئيس الفعاليات.', ephemeral: true });
  }
  if (!isGroupGameChannelAllowed(source.guildId, source.channelId)) {
    return safeReply(source, { content: '🚫 هاد الروم ما مسموحش فيه تشغيل الفعاليات الجماعية.', ephemeral: true });
  }
  return createGroupLobby(source, gameId);
}

export async function handleGameCommand(interaction, gameId) {
  if (!GROUP_GAMES.has(gameId) && !SOLO_GAMES.has(gameId)) return safeReply(interaction, { content: '❌ هذه اللعبة غير متاحة حالياً.', ephemeral: true });
  if (activeGames.has(interaction.channelId)) return safeReply(interaction, { content: '⚠️ توجد لعبة أو فعالية نشطة في هذه القناة.', ephemeral: true });

  if (GROUP_GAMES.has(gameId)) return startGroupGame(interaction, gameId);

  const settings = getGuildSettings(interaction.guildId);
  if (settings.individualGameChannelId && settings.individualGameChannelId !== interaction.channelId) {
    return safeReply(interaction, { content: '🚫 الألعاب الفردية مخصصة لروم أخرى في هذا السيرفر.', ephemeral: true });
  }
  return startSolo(interaction.channel, interaction.guildId, gameId, interaction.user.id, interaction);
}

async function createGroupLobby(source, gameId) {
  const state = newGroupState(source, gameId);
  activeGames.set(state.channelId, state);

  if (source.isChatInputCommand?.()) {
    await source.reply({ embeds: [lobbyEmbed(state)], components: lobbyComponents(state) });
    state.message = await source.fetchReply().catch(() => null);
  } else {
    state.message = await source.channel.send({ embeds: [lobbyEmbed(state)], components: lobbyComponents(state) }).catch(() => null);
  }

  if (!state.message) {
    activeGames.delete(state.channelId);
    return;
  }
  state.timeout = setTimeout(() => autoStart(state).catch(console.error), state.lobbySeconds * 1000);
}

async function autoStart(state) {
  if (state.cancelled || state.finished || state.started || !activeGames.has(state.channelId)) return;
  if (state.players.length < minPlayers(state.id)) {
    activeGames.delete(state.channelId);
    clearTimeout(state.timeout);
    await state.message.edit({ embeds: [lobbyEmbed(state).setDescription(`${lobbyEmbed(state).data.description}\n\n⏱️ انتهى الوقت قبل اكتمال الحد الأدنى، وتم إلغاء الفعالية.`)], components: [] }).catch(() => {});
    return;
  }
  await startGroup(state, state.message.channel);
}

async function startGroup(state, channel) {
  if (state.started || state.finished || state.cancelled) return;
  state.started = true;
  clearTimeout(state.timeout);
  await state.message?.edit({ components: lobbyComponents(state, true) }).catch(() => {});
  await launchGroup(state, channel || state.message?.channel);
}

async function finish(state, channel, winners = [], reason = null) {
  if (state.finished) return;
  state.finished = true;
  stopCollectors(state);
  clearTimeout(state.timeout);
  activeGames.delete(state.channelId);

  const result = reason || (winners.length ? `🏆 الفائز: ${mention(winners)}` : '⏱️ انتهت الفعالية بلا فائز.');
  await channel?.send({
    embeds: [new EmbedBuilder()
      .setTitle(`🏁 ${GAME_NAMES[state.id]} انتهت`)
      .setDescription(`${result}\n\n${winners.length ? `🎖️ كل فائز حصل على **${state.winnerPoints} نقطة**.` : 'لم تُحتسب نقاط.'}`)],
  }).catch(() => {});

  for (const id of state.players) {
    recordGame(state.guildId, id, winners.includes(id), winners.includes(id) ? state.winnerPoints : 0);
  }
}

async function launchGroup(state, channel) {
  if (!channel) return finish(state, null, [], 'تعذر الوصول إلى قناة الفعالية.');
  try {
    switch (state.id) {
      case 'xo': return playXO(channel, state, false);
      case 'hotxo': return playXO(channel, state, true);
      case 'rps': return playRPS(channel, state);
      case 'dice': return playDice(channel, state);
      case 'race': return playRace(channel, state);
      case 'chairs': return playChairs(channel, state);
      case 'mafia': return playMafia(channel, state);
      case 'hide': return playHide(channel, state);
      case 'replica': return playText(channel, state, 'ريبلكا', ['مغرب','مدينة','مدرسة','سيارة','برمجة'], 'اكتب الكلمة المطلوبة.');
      case 'country': return playText(channel, state, 'خمّن الدولة', ['المغرب','اليابان','فرنسا','البرازيل','مصر','كندا'], 'خمّن الدولة.');
      case 'draw': return playText(channel, state, 'خمّن الرسمة', ['شمس','قطة','بيت','كرة','سيارة'], 'خمّن الرسمة من التلميح.');
      case 'word': return playText(channel, state, 'خمّن الكلمة', ['مكتبة','مغامرة','بطولة','حاسوب','مستقبل','لعبة'], 'خمّن الكلمة.');
      case 'wheel': return playWheel(channel, state);
      default: return finish(state, channel, [], 'هذه الفعالية غير متوفرة حالياً.');
    }
  } catch (error) {
    console.error(`[${state.id}]`, error);
    return finish(state, channel, [], 'حدث خطأ أثناء تشغيل الفعالية وتم إنهاؤها بأمان.');
  }
}

export async function cancelActiveGame(channelId) {
  const state = activeGames.get(channelId);
  if (!state) return false;
  state.cancelled = true;
  clearTimeout(state.timeout);
  stopCollectors(state);
  activeGames.delete(channelId);
  await state.message?.edit({ components: [] }).catch(() => {});
  await state.message?.channel?.send({ embeds: [new EmbedBuilder().setTitle(`🛑 ${GAME_NAMES[state.id]} توقفت`).setDescription('تم إيقاف اللعبة من طرف الإدارة أو رئيس الفعاليات.')] }).catch(() => {});
  return true;
}

export async function handlePrefixGame(message, command) {
  if (!message.guild || message.author.bot) return false;

  if (command === GROUP_STOP) {
    const state = activeGames.get(message.channelId);
    if (!state) {
      await message.reply('ℹ️ ما كاينة حتى لعبة نشطة فهاد الروم.').catch(() => {});
      return true;
    }
    if (!canRunGroup(message.member, getGuildSettings(message.guildId))) {
      await message.reply('⛔ غير الإدارة أو رئيس الفعاليات يقدرو يوقفو اللعبة.').catch(() => {});
      return true;
    }
    await cancelActiveGame(message.channelId);
    return true;
  }

  const groupId = PREFIX_ALIASES.group[command];
  const soloId = PREFIX_ALIASES.solo[command];
  if (!groupId && !soloId) return false;

  if (activeGames.has(message.channelId)) {
    await message.reply('⚠️ كاينة لعبة أو فعالية خدامة دابا فهاد الروم.').catch(() => {});
    return true;
  }

  if (groupId) {
    await startGroupGame(message, groupId);
    return true;
  }

  const settings = getGuildSettings(message.guildId);
  if (settings.individualGameChannelId && settings.individualGameChannelId !== message.channelId) {
    await message.reply('🚫 الألعاب الفردية مخصصة لروم أخرى في هذا السيرفر.').catch(() => {});
    return true;
  }
  await startSolo(message.channel, message.guildId, soloId, message.author.id, message);
  return true;
}

export async function handleButton(interaction) {
  const [type, key, action] = interaction.customId.split(':');
  if (type === 'lobby') return handleLobbyButton(interaction, key, action);

  const state = activeGames.get(interaction.channelId);
  if (!state || state.finished || state.cancelled) return safeReply(interaction, { content: 'لا توجد لعبة نشطة.', ephemeral: true });
  if (type === 'xo') return handleXOButton(interaction, state, key, action);
  if (type === 'rps') return handleRPSButton(interaction, state, key, action);
  if (type === 'chairs') return handleChairButton(interaction, state, key, action);
  if (type === 'solo') return handleSoloButton(interaction, state, key, action);
  return safeReply(interaction, { content: 'هذا الزر لم يعد صالحاً.', ephemeral: true });
}

async function handleLobbyButton(interaction, key, action) {
  const state = activeGames.get(interaction.channelId);
  if (!state || state.key !== key || state.started || state.finished) return safeReply(interaction, { content: 'انتهت الفعالية أو لم تعد متاحة.', ephemeral: true });

  if (action === 'join') {
    if (state.players.includes(interaction.user.id)) return safeReply(interaction, { content: 'أنت منضم بالفعل.', ephemeral: true });
    if (state.players.length >= state.maxPlayers) return safeReply(interaction, { content: 'وصلنا للحد الأقصى من اللاعبين.', ephemeral: true });
    state.players.push(interaction.user.id);
    await interaction.update({ embeds: [lobbyEmbed(state)], components: lobbyComponents(state) });
    return;
  }

  if (action === 'cancel' || action === 'start') {
    const settings = getGuildSettings(state.guildId);
    const manager = canRunGroup(interaction.member, settings);
    if (interaction.user.id !== state.hostId && !manager) return safeReply(interaction, { content: 'غير مسموح لك بهذا الإجراء.', ephemeral: true });
    if (action === 'start') {
      if (state.players.length < minPlayers(state.id)) return safeReply(interaction, { content: `خاصكم على الأقل ${minPlayers(state.id)} لاعبين.`, ephemeral: true });
      await interaction.deferUpdate();
      return startGroup(state, interaction.channel);
    }
    state.cancelled = true;
    clearTimeout(state.timeout);
    activeGames.delete(state.channelId);
    await interaction.update({ embeds: [lobbyEmbed(state).setDescription('🛑 تم إلغاء الفعالية.')], components: [] });
  }
}

async function handleXOButton(interaction, state, roundKey, action) {
  const round = state.currentRound;
  if (!round || round.key !== roundKey || round.message?.id !== interaction.message.id) return safeReply(interaction, { content: 'هذه الجولة ليست نشطة.', ephemeral: true });
  const expected = round.turn === 0 ? round.a : round.b;
  if (interaction.user.id !== expected) return safeReply(interaction, { content: 'ليس دورك الآن.', ephemeral: true });
  const index = Number(action);
  if (!Number.isInteger(index) || index < 0 || index > 8 || round.board[index]) return safeReply(interaction, { content: 'هذه الخانة غير متاحة.', ephemeral: true });
  round.board[index] = round.turn === 0 ? '❌' : '⭕';
  round.moves += 1;
  const win = winner(round.board);
  if (win || (!round.hot && round.board.every(Boolean))) {
    const roundWinner = win ? expected : random([round.a, round.b]);
    round.resolve(roundWinner);
    await interaction.deferUpdate().catch(() => {});
    await round.message.edit({ embeds: [xoEmbed(round.a, round.b, round.board, round.turn, true)], components: xoRows(round.board, false, round.key) }).catch(() => {});
    return;
  }
  if (round.hot && round.moves >= 6) {
    const own = round.turn === 0 ? '❌' : '⭕';
    const mine = round.board.map((v, i) => v === own ? i : -1).filter(i => i >= 0);
    if (mine.length) round.board[random(mine)] = null;
  }
  round.turn = round.turn === 0 ? 1 : 0;
  await interaction.update({ embeds: [xoEmbed(round.a, round.b, round.board, round.turn)], components: xoRows(round.board, true, round.key) });
}

async function playXO(channel, state, hot) {
  let players = shuffle(state.players);
  while (players.length > 1 && !state.cancelled) {
    const next = [];
    for (let i = 0; i < players.length; i += 2) {
      if (!players[i + 1]) { next.push(players[i]); continue; }
      const a = players[i], b = players[i + 1];
      const board = Array(9).fill(null);
      const roundKey = keygen();
      const msg = await channel.send({ embeds: [xoEmbed(a, b, board, 0)], components: xoRows(board, true, roundKey) });
      const winnerId = await new Promise(resolve => {
        state.currentRound = { key: roundKey, a, b, board, message: msg, turn: 0, moves: 0, hot, resolve };
        state.currentRound.timer = setTimeout(() => resolve(null), 30000);
      });
      clearTimeout(state.currentRound?.timer);
      state.currentRound = null;
      if (winnerId) next.push(winnerId); else next.push(random([a, b]));
    }
    players = shuffle(next);
  }
  await finish(state, channel, players[0] && !state.cancelled ? [players[0]] : []);
}

function xoRows(board, enabled, key) {
  return [0,1,2].map(row => new ActionRowBuilder().addComponents([0,1,2].map(col => {
    const i = row * 3 + col;
    return new ButtonBuilder().setCustomId(`xo:${key}:${i}`).setLabel(board[i] || '·').setStyle(board[i] ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(!enabled || Boolean(board[i]));
  })));
}

function xoEmbed(a, b, board, turn, done = false) {
  const current = turn === 0 ? a : b;
  const boardText = [0,1,2].map(r => board.slice(r * 3, r * 3 + 3).map(v => v || '▫️').join(' ')).join('\n');
  return new EmbedBuilder().setTitle('⭕ XO ❌').setDescription(`❌ <@${a}>\n⭕ <@${b}>\n\n${boardText}\n\n${done ? '🏁 الجولة انتهت.' : `الدور: <@${current}>`}`);
}

function winner(board) {
  for (const [a,b,c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

async function handleRPSButton(interaction, state, roundKey, action) {
  const round = state.currentRound;
  if (!round || round.key !== roundKey || !round.messageId || round.messageId !== interaction.message.id) return safeReply(interaction, { content: 'هذه الجولة ليست نشطة.', ephemeral: true });
  if (!round.alive.includes(interaction.user.id)) return safeReply(interaction, { content: 'أنت لست ضمن هذه الجولة.', ephemeral: true });
  if (round.picks.has(interaction.user.id)) return safeReply(interaction, { content: 'تم تسجيل اختيارك من قبل.', ephemeral: true });
  const choice = Number(action);
  if (![0,1,2].includes(choice)) return safeReply(interaction, { content: 'اختيار غير صالح.', ephemeral: true });
  round.picks.set(interaction.user.id, choice);
  await interaction.reply({ content: '✅ تسجل الاختيار.', ephemeral: true }).catch(() => {});
  if (round.picks.size >= round.alive.length) round.resolve();
}

async function playRPS(channel, state) {
  let alive = [...state.players];
  while (alive.length > 1 && !state.cancelled) {
    const picks = new Map();
    const roundKey = keygen();
    state.currentRound = { key: roundKey, alive, picks, resolve: () => {}, messageId: null, timer: null };
    const message = await channel.send({ content: '✊ **حجرة ورقة مقص** — اختار قبل ما يسالي الوقت!', components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rps:${roundKey}:0`).setLabel('حجرة').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rps:${roundKey}:1`).setLabel('ورقة').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rps:${roundKey}:2`).setLabel('مقص').setStyle(ButtonStyle.Primary),
    )] });
    state.currentRound.messageId = message.id;
    await new Promise(resolve => {
      state.currentRound.resolve = resolve;
      state.currentRound.timer = setTimeout(resolve, 12000);
    });
    clearTimeout(state.currentRound.timer);
    for (const id of alive) if (!picks.has(id)) picks.set(id, Math.floor(Math.random() * 3));
    const result = rpsWinner([...picks.values()]);
    if (result === null) { await channel.send('🤝 تعادل — جولة جديدة.'); continue; }
    alive = alive.filter(id => picks.get(id) === result);
    if (alive.length > 1) await channel.send(`⭐ المتبقون: ${mention(alive)}`);
  }
  state.currentRound = null;
  await finish(state, channel, alive[0] ? [alive[0]] : []);
}

function rpsWinner(values) {
  const present = new Set(values);
  if (present.size <= 1 || present.size === 3) return null;
  if (present.has(0) && present.has(2)) return 0;
  if (present.has(0) && present.has(1)) return 1;
  return 2;
}

async function handleChairButton(interaction, state, roundKey, action) {
  const round = state.currentRound;
  if (!round || round.key !== roundKey || round.messageId !== interaction.message.id || action !== 'sit') return safeReply(interaction, { content: 'هذه الجولة ليست نشطة.', ephemeral: true });
  if (!round.players.includes(interaction.user.id)) return safeReply(interaction, { content: 'أنت لست ضمن الجولة.', ephemeral: true });
  if (round.seated.has(interaction.user.id)) return safeReply(interaction, { content: 'جلستي من قبل.', ephemeral: true });
  if (round.seated.size >= round.seats) return safeReply(interaction, { content: 'الكراسي تسدو.', ephemeral: true });
  round.seated.add(interaction.user.id);
  await interaction.reply({ content: '🪑 جلستي!', ephemeral: true }).catch(() => {});
  if (round.seated.size >= round.seats) round.resolve();
}

async function playChairs(channel, state) {
  let players = [...state.players];
  while (players.length > 1 && !state.cancelled) {
    const seats = players.length - 1;
    const roundKey = keygen();
    state.currentRound = { key: roundKey, players, seats, seated: new Set(), resolve: () => {}, timer: null, messageId: null };
    const message = await channel.send({ content: `🎵 **كراسي** — عندكم **${seats}** كراسي. اللي ما يلقى كرسي يخرج.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`chairs:${roundKey}:sit`).setLabel('اجلس 🪑').setStyle(ButtonStyle.Success))] });
    state.currentRound.messageId = message.id;
    await new Promise(resolve => {
      state.currentRound.resolve = resolve;
      state.currentRound.timer = setTimeout(resolve, 15000);
    });
    clearTimeout(state.currentRound.timer);
    const out = shuffle(players.filter(id => !state.currentRound.seated.has(id)))[0] || random(players);
    players = players.filter(id => id !== out);
    await channel.send(`❌ خرج: <@${out}>\n✅ الباقون: ${mention(players)}`);
  }
  state.currentRound = null;
  await finish(state, channel, players[0] ? [players[0]] : []);
}

async function playRace(channel, state) {
  const players = [...state.players];
  const positions = Object.fromEntries(players.map(id => [id, 0]));
  const target = 30;

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🏁 سباق')
      .setDescription('استعدوا! كل جولة كتزيد المسافة بشكل عشوائي.')
    ],
  }).catch(() => {});

  while (Math.max(...Object.values(positions), 0) < target && !state.cancelled) {
    for (const id of players) positions[id] += 1 + Math.floor(Math.random() * 6);

    const rows = players.map(id => {
      const progress = Math.min(10, Math.floor((positions[id] * 10) / target));
      return `<@${id}> ${'🟩'.repeat(progress)}${'⬜'.repeat(10 - progress)} **${positions[id]}**`;
    });

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🏁 السباق')
        .setDescription(rows.join('\n'))],
    }).catch(() => {});

    await sleep(1200);
  }

  const top = Math.max(...players.map(id => positions[id]), 0);
  const winners = players.filter(id => positions[id] === top);
  await finish(
    state,
    channel,
    winners,
    `📊 النتيجة النهائية:\n${players.map(id => `<@${id}> — **${positions[id]}**`).join('\n')}\n\n🏆 الفائز: ${mention(winners)}`,
  );
}

async function playDice(channel, state) {
  const teams = [[], []];
  shuffle(state.players).forEach((id, i) => teams[i % 2].push(id));
  const scores = [0, 0];
  for (let round = 1; round <= 3; round++) {
    const rolls = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    scores[0] += rolls[0];
    scores[1] += rolls[1];
    await channel.send(`🎲 الجولة ${round}: الفريق 1 **${rolls[0]}** — الفريق 2 **${rolls[1]}**`);
    await sleep(800);
  }
  const winners = scores[0] === scores[1] ? [random(state.players)] : (scores[0] > scores[1] ? teams[0] : teams[1]);
  await finish(state, channel, winners, `📊 النتيجة النهائية: **${scores[0]} - ${scores[1]}**\n🏆 ${mention(winners)}`);
}

async function playMafia(channel, state) {
  const players = [...state.players];
  const mafiaCount = Math.max(1, Math.floor(players.length / 4));
  const mafia = new Set(shuffle(players).slice(0, mafiaCount));
  for (const id of players) {
    await channel.guild.members.fetch(id).then(member => member.send(`🎭 دورك في مافيا: **${mafia.has(id) ? 'مافيا' : 'مواطن'}**.`)).catch(() => {});
  }
  await channel.send(`🎭 بدأت مافيا بـ **${players.length}** لاعبين. الأدوار توصلات فالخاص.`);
  await sleep(7000);
  const town = players.filter(id => !mafia.has(id));
  const mafiaWins = mafia.size >= Math.max(1, town.length - 1);
  const winners = mafiaWins ? [...mafia] : town;
  await finish(state, channel, winners, `🎭 النتيجة: **${mafiaWins ? 'المافيا فازت' : 'المواطنون فازوا'}**\n🏆 ${mention(winners)}`);
}

async function playHide(channel, state) {
  const seeker = state.players[0];
  const hiders = state.players.slice(1);
  await channel.send(`🙈 <@${seeker}> هو الباحث. عند الباقي 8 ثواني للاختباء.`);
  await sleep(8000);
  const found = new Set(shuffle(hiders).slice(0, Math.floor(hiders.length / 2)));
  const survivors = hiders.filter(id => !found.has(id));
  await channel.send(`🔎 تم العثور على: ${found.size ? mention([...found]) : 'حتى واحد'}\n🙈 الناجون: ${survivors.length ? mention(survivors) : 'لا أحد'}`);
  await finish(state, channel, survivors.length ? survivors : [seeker]);
}

async function playText(channel, state, title, answers, instruction) {
  const answer = random(answers);
  await channel.send({ embeds: [new EmbedBuilder().setTitle(`🎯 ${title}`).setDescription(`${instruction}\n\n⏱️ عندكم 15 ثانية.`)] });
  const collector = rememberCollector(state, channel.createMessageCollector({ time: 15000, filter: message => state.players.includes(message.author.id) }));
  let winnerId = null;
  collector.on('collect', message => {
    if (message.content.trim().toLowerCase() !== answer.toLowerCase()) return;
    winnerId = message.author.id;
    collector.stop('winner');
  });
  await new Promise(resolve => collector.once('end', resolve));
  await finish(state, channel, winnerId ? [winnerId] : [], winnerId ? `🏆 <@${winnerId}> جاوب أولاً بشكل صحيح.` : `⏱️ سالات الجولة. الإجابة كانت **${answer}**.`);
}

async function playWheel(channel, state) {
  await channel.send('🎡 **روليت** — عجلة ترفيهية عشوائية، بلا رهانات أو عملات.');
  let pool = [...state.players];
  while (pool.length > 1 && !state.cancelled) {
    await sleep(700);
    const out = random(pool);
    pool = pool.filter(id => id !== out);
    await channel.send(`🎡 خرج: <@${out}>\n👥 المتبقون: ${mention(pool)}`);
  }
  await finish(state, channel, pool.length ? [pool[0]] : []);
}

async function startSolo(channel, guildId, gameId, starterId, source) {
  const tasks = {
    button: { prompt: 'اضغط الزر أولاً!', answers: null, button: true },
    fast: { prompt: null, answers: ['أسرع','فوز','لعبة','نجم'] },
    split: { prompt: 'فكك الكلمة: **ديسكورد**', answers: ['د ي س ك و ر د'] },
    merge: { prompt: 'ادمج: **ديس كورد**', answers: ['ديسكورد'] },
    flag: { prompt: 'شنو الدولة ديال 🇲🇦 ؟', answers: ['المغرب','morocco'] },
    reverse: { prompt: 'اعكس: **رباط**', answers: ['طابر'] },
    letter: { prompt: 'عطيني كلمة كتبدأ بحرف **م**', answers: null },
    correct: { prompt: 'صحح: **المغرب جميله**', answers: ['المغرب جميل'] },
    sort: { prompt: 'رتب الأرقام: **3 1 4 2**', answers: ['1 2 3 4'] },
    colors: { prompt: 'شنو اللون ديال 🟩 ؟', answers: ['أخضر','green'] },
    emoji: { prompt: 'شنو كتعبّر 😴 ؟', answers: ['نعاس','نائم','نوم'] },
    reveal: { prompt: 'كمّل: **ديس...**', answers: ['ديسكورد'] },
  };
  const task = tasks[gameId];
  if (!task) return;

  if (task.button) {
    const key = keygen();
    const sent = await channel.send({ content: `${task.prompt}\n🎮 هادي لعبة فردية، ما كتمنح حتى نقطة.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`solo:${key}:press`).setLabel('اضغط!').setStyle(ButtonStyle.Success))] }).catch(() => null);
    if (!sent) return;
    const state = { id: gameId, key, guildId, channelId: channel.id, starterId, message: sent, finished: false };
    activeGames.set(channel.id, state);
    state.collector = sent.createMessageComponentCollector({ time: 10000 });
    rememberCollector(state, state.collector);
    state.collector.on('collect', async interaction => {
      if (state.finished) return;
      state.finished = true;
      state.collector.stop('winner');
      activeGames.delete(channel.id);
      await interaction.update({ content: `🏆 <@${interaction.user.id}> ضغط أولاً!\n🎮 بلا نقاط — هادي لعبة فردية.`, components: [] }).catch(() => {});
    });
    state.collector.once('end', async (_, reason) => {
      if (reason === 'winner' || state.finished) return;
      activeGames.delete(channel.id);
      await sent.edit({ components: [] }).catch(() => {});
      await channel.send('⏱️ سالات لعبة الزر بلا فائز.').catch(() => {});
    });
    return;
  }

  const answer = gameId === 'fast' ? random(task.answers) : null;
  const prompt = gameId === 'fast' ? `⚡ **أسرع:** كتب بالضبط: **${answer}**` : task.prompt;
  if (source?.isChatInputCommand?.()) await source.editReply({ content: `${prompt}\n🎮 هادي لعبة فردية، ما كتمنح حتى نقطة.` }).catch(() => {});
  else await channel.send(`${prompt}\n🎮 هادي لعبة فردية، ما كتمنح حتى نقطة.`).catch(() => {});

  const collector = channel.createMessageCollector({ time: 10000, filter: message => !message.author.bot });
  const state = { id: gameId, guildId, channelId: channel.id, starterId, finished: false, answer };
  activeGames.set(channel.id, state);
  rememberCollector(state, collector);
  collector.on('collect', message => {
    const value = message.content.trim();
    const accepted = task.answers
      ? (gameId === 'fast' ? value.toLowerCase() === answer.toLowerCase() : task.answers.some(v => v.toLowerCase() === value.toLowerCase()))
      : (gameId === 'letter' && value.startsWith('م'));
    if (!accepted || state.finished) return;
    state.finished = true;
    collector.stop('winner');
    activeGames.delete(channel.id);
    channel.send(`🏆 <@${message.author.id}> جاوب صحيح!\n🎮 لعبة فردية = **0 نقاط**.`).catch(() => {});
  });
  collector.once('end', (_, reason) => {
    if (reason === 'winner' || state.finished) return;
    activeGames.delete(channel.id);
    channel.send(`⏱️ سالات **${GAME_NAMES[gameId]}** بلا فائز.`).catch(() => {});
  });
}

async function handleSoloButton(interaction, state, key, action) {
  if (state.id !== 'button' || state.key !== key || action !== 'press') return safeReply(interaction, { content: 'هذا الزر لم يعد صالحاً.', ephemeral: true });
}

async function handleModal() {}
export { handleModal };
