import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import {
  handleGameCommand,
  handleButton,
  handleModal,
  handlePrefixGame,
  activeGames,
  canRunGroup,
  cancelActiveGame,
} from './games-engine.js';
import { handleDrawMessage, handleDrawButton, startDrawGame, stopDrawState } from './draw-game.js';
import { initDatabase, getGuildSettings, setGuildSettings, getPlayerStats, getLeaderboard, setDrawSettings } from './store.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID || null;

if (!token || !clientId) throw new Error('يرجى ضبط DISCORD_TOKEN و CLIENT_ID في ملف البيئة.');
await initDatabase();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember, Partials.Channel],
});

const choices = [
  ['xo', 'XO'], ['mafia', 'مافيا'], ['chairs', 'كراسي'], ['rps', 'حجرة ورقة مقص'],
  ['dice', 'نرد'], ['hotxo', 'HotXO'], ['hide', 'غميضة'], ['replica', 'ريبلكا'],
  ['country', 'خمّن الدولة'], ['draw', 'خمّن الرسمة'], ['word', 'خمّن الكلمة'], ['wheel', 'روليت'],
  ['button', 'زر'], ['fast', 'أسرع'], ['split', 'فكك'], ['merge', 'ادمج'], ['flag', 'أعلام'],
  ['reverse', 'اعكس'], ['letter', 'حرف'], ['correct', 'صحح'], ['sort', 'ترتيب'], ['colors', 'ألوان'],
  ['emoji', 'إيموجي'], ['reveal', 'اكشف'],
];

const play = new SlashCommandBuilder()
  .setName('لعب')
  .setDescription('بدء لعبة فردية أو فعالية جماعية')
  .addStringOption(option => {
    option.setName('اللعبة').setDescription('اختر اللعبة').setRequired(true);
    for (const [value, name] of choices) option.addChoices({ name, value });
    return option;
  });

const settings = new SlashCommandBuilder()
  .setName('إعدادات-الألعاب')
  .setDescription('إعدادات الألعاب الخاصة بهذا السيرفر')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addRoleOption(option => option.setName('رئيس_الفعاليات').setDescription('الرتبة المسموح لها بإدارة الفعاليات'))
  .addIntegerOption(option => option.setName('نقاط_الفائز').setDescription('النقاط التي يحصل عليها كل فائز').setMinValue(1).setMaxValue(50))
  .addIntegerOption(option => option.setName('الحد_الأقصى').setDescription('الحد الأقصى للاعبين في الفعالية').setMinValue(2).setMaxValue(20))
  .addIntegerOption(option => option.setName('مدة_الانتظار').setDescription('مدة الـLobby بالثواني').setMinValue(10).setMaxValue(120));

const drawSettingsCommand = new SlashCommandBuilder()
  .setName('إعدادات-الرسمة')
  .setDescription('إعدادات فعالية خمّن الرسمة')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption(option => option.setName('الحد_الأقصى').setDescription('الحد الأقصى للاعبين').setMinValue(3).setMaxValue(20))
  .addIntegerOption(option => option.setName('مؤقت_البداية').setDescription('وقت الـLobby بالثواني').setMinValue(10).setMaxValue(90))
  .addStringOption(option => option.setName('الصعوبة').setDescription('مستوى الكلمات').addChoices(
    { name: 'سهل', value: 'easy' },
    { name: 'متوسط', value: 'medium' },
    { name: 'صعب', value: 'hard' },
  ))
  .addBooleanOption(option => option.setName('الرسم_المتحرك').setDescription('إظهار الرسم على مراحل متتابعة'))
  .addRoleOption(option => option.setName('منشن_البداية').setDescription('رتبة يتم منشنها عند بداية الـLobby'))
  .addStringOption(option => option.setName('رسالة_البداية').setDescription('رسالة البداية المخصصة'));

const stats = new SlashCommandBuilder().setName('نقاطي').setDescription('عرض نقاطك وإحصائياتك في هذا السيرفر');
const leaderboard = new SlashCommandBuilder().setName('ترتيب-الألعاب').setDescription('عرض أفضل لاعبي الألعاب في هذا السيرفر');
const stop = new SlashCommandBuilder().setName('إيقاف-اللعبة').setDescription('إيقاف اللعبة الحالية في القناة');

const rest = new REST({ version: '10' }).setToken(token);
await rest.put(
  guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId),
  { body: [play, settings, drawSettingsCommand, stats, leaderboard, stop].map(command => command.toJSON()) },
);

client.once('ready', () => {
  console.log(`✅ تم تسجيل الدخول باسم ${client.user.tag}`);
  client.user.setActivity('ألعاب ديسكورد | .اسرع | -رسمة');
});

async function handleSettingsCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '⛔ تحتاج صلاحية إدارة السيرفر.', ephemeral: true });
  }
  const patch = {};
  const role = interaction.options.getRole('رئيس_الفعاليات');
  const points = interaction.options.getInteger('نقاط_الفائز');
  const maxPlayers = interaction.options.getInteger('الحد_الأقصى');
  const lobbySeconds = interaction.options.getInteger('مدة_الانتظار');
  if (role) patch.eventRoleId = role.id;
  if (points !== null) patch.winnerPoints = points;
  if (maxPlayers !== null) patch.maxPlayers = maxPlayers;
  if (lobbySeconds !== null) patch.lobbySeconds = lobbySeconds;

  const current = setGuildSettings(interaction.guildId, patch);
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('⚙️ إعدادات الألعاب')
      .setDescription([
        `👑 رئيس الفعاليات: ${current.eventRoleId ? `<@&${current.eventRoleId}>` : 'غير محدد'}`,
        `🏆 نقاط الفائز: **${current.winnerPoints}**`,
        `👥 الحد الأقصى: **${current.maxPlayers}** لاعب`,
        `⏱️ مدة الـLobby: **${current.lobbySeconds}** ثانية`,
        '',
        'الفردي: `.<اللعبة>` — متاح للجميع ولا يمنح نقاطاً.',
        'الجماعي: `-<اللعبة>` — فعالية تحتاج الإدارة أو رئيس الفعاليات وتمنح نقاطاً للفائزين.',
      ].join('\n'))],
  });
}

async function handleDrawSettingsCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '⛔ تحتاج صلاحية إدارة السيرفر.', ephemeral: true });
  }
  const patch = {};
  const maxPlayers = interaction.options.getInteger('الحد_الأقصى');
  const startSeconds = interaction.options.getInteger('مؤقت_البداية');
  const difficulty = interaction.options.getString('الصعوبة');
  const animated = interaction.options.getBoolean('الرسم_المتحرك');
  const mentionRole = interaction.options.getRole('منشن_البداية');
  const startMessage = interaction.options.getString('رسالة_البداية');
  if (maxPlayers !== null) patch.maxPlayers = maxPlayers;
  if (startSeconds !== null) patch.startSeconds = startSeconds;
  if (difficulty) patch.difficulty = difficulty;
  if (animated !== null) patch.animated = animated;
  if (mentionRole) patch.startMentionRoleId = mentionRole.id;
  if (startMessage !== null) patch.startMessage = startMessage;

  const current = setDrawSettings(interaction.guildId, patch);
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🎨 إعدادات خمّن الرسمة')
      .setDescription([
        '🔟 عدد الجولات: **10** (ثابت)',
        `👥 الحد الأقصى: **${current.maxPlayers}** لاعب`,
        `⏱️ مؤقت البداية: **${current.startSeconds}** ثانية`,
        `🧩 الصعوبة: **${current.difficulty === 'easy' ? 'سهل' : current.difficulty === 'medium' ? 'متوسط' : 'صعب'}**`,
        `🎞️ الرسم: **${current.animated ? 'متحرك/متدرج' : 'صور متدرجة'}**`,
        `📣 منشن البداية: ${current.startMentionRoleId ? `<@&${current.startMentionRoleId}>` : 'لا يوجد'}`,
        `📝 رسالة البداية: ${current.startMessage ? `**${current.startMessage}**` : 'افتراضية'}`,
        '',
        '💡 كل لاعب عندو تلميح واحد فقط فكل جولة، والتلميح كيبان ليه بوحده.',
      ].join('\n'))],
  });
}

async function handleStatsCommand(interaction) {
  const value = getPlayerStats(interaction.guildId, interaction.user.id);
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle(`📊 إحصائيات ${interaction.member.displayName}`)
      .setDescription(`🏆 النقاط: **${value.points}**\n🥇 الانتصارات: **${value.wins}**\n🎮 المشاركات الجماعية: **${value.games}**`)],
  });
}

async function handleLeaderboardCommand(interaction) {
  const rows = getLeaderboard(interaction.guildId, 10);
  const lines = rows.length
    ? rows.map((row, index) => `**${index + 1}.** <@${row.userId}> — **${row.points}** نقطة | ${row.wins} فوز`).join('\n')
    : 'لا توجد نتائج بعد.';
  return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 ترتيب الألعاب').setDescription(lines)] });
}

async function startDrawSafely(source) {
  if (!canRunGroup(source.member, getGuildSettings(source.guildId))) {
    if (source.isChatInputCommand?.()) await source.reply({ content: '⛔ غير الإدارة أو رئيس الفعاليات يقدرو يبداو فعالية خمّن الرسمة.', ephemeral: true }).catch(() => {});
    else await source.reply('⛔ غير الإدارة أو رئيس الفعاليات يقدرو يبداو فعالية خمّن الرسمة.').catch(() => {});
    return false;
  }
  return startDrawGame(source);
}

async function stopCurrentGame(interaction) {
  const state = activeGames.get(interaction.channelId);
  if (!state) {
    await interaction.reply({ content: 'ℹ️ لا توجد لعبة نشطة في هذه القناة.', ephemeral: true }).catch(() => {});
    return false;
  }
  if (!canRunGroup(interaction.member, getGuildSettings(interaction.guildId))) {
    await interaction.reply({ content: '⛔ غير مسموح لك بإيقاف اللعبة.', ephemeral: true }).catch(() => {});
    return false;
  }
  if (state.id === 'draw') {
    await stopDrawState(state);
    await interaction.reply({ content: '✅ تم إيقاف فعالية خمّن الرسمة.', ephemeral: true }).catch(() => {});
    await state.message?.channel?.send({ embeds: [new EmbedBuilder().setTitle('🛑 خمّن الرسمة توقفت').setDescription('تم إيقاف الفعالية من طرف الإدارة أو رئيس الفعاليات.')] }).catch(() => {});
    return true;
  }
  const stopped = await cancelActiveGame(interaction.channelId);
  await interaction.reply({ content: stopped ? '✅ تم إيقاف اللعبة الحالية.' : 'ℹ️ لا توجد لعبة نشطة في هذه القناة.', ephemeral: true }).catch(() => {});
  return stopped;
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'لعب') {
        const game = interaction.options.getString('اللعبة', true);
        if (game === 'draw') await startDrawSafely(interaction);
        else await handleGameCommand(interaction, game);
      } else if (interaction.commandName === 'إعدادات-الألعاب') {
        await handleSettingsCommand(interaction);
      } else if (interaction.commandName === 'إعدادات-الرسمة') {
        await handleDrawSettingsCommand(interaction);
      } else if (interaction.commandName === 'نقاطي') {
        await handleStatsCommand(interaction);
      } else if (interaction.commandName === 'ترتيب-الألعاب') {
        await handleLeaderboardCommand(interaction);
      } else if (interaction.commandName === 'إيقاف-اللعبة') {
        await stopCurrentGame(interaction);
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('draw:') || interaction.customId.startsWith('drawlobby:')) {
        await handleDrawButton(interaction);
      } else {
        await handleButton(interaction);
      }
      return;
    }

    if (interaction.isModalSubmit()) await handleModal(interaction);
  } catch (error) {
    console.error(error);
    const payload = { content: 'حدث خطأ غير متوقع أثناء تشغيل اللعبة. حاول مرة أخرى.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  const command = message.content.trim().split(/\s+/)[0];

  if (command === '-رسمة') {
    await startDrawSafely(message);
    return;
  }

  const drawState = activeGames.get(message.channelId);
  if (drawState?.id === 'draw' && command === '-توقيف') {
    if (!canRunGroup(message.member, getGuildSettings(message.guildId))) {
      await message.reply('⛔ غير الإدارة أو رئيس الفعاليات يقدرو يوقفو الفعالية.').catch(() => {});
      return;
    }
    await stopDrawState(drawState);
    await message.reply('✅ تم إيقاف فعالية خمّن الرسمة.').catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setTitle('🛑 خمّن الرسمة توقفت').setDescription('تم إيقاف الفعالية من طرف الإدارة أو رئيس الفعاليات.')] }).catch(() => {});
    return;
  }

  try {
    if (!command.startsWith('.') && !command.startsWith('-')) {
      await handleDrawMessage(message).catch(error => console.error('[draw]', error));
      return;
    }
    const handledDrawGuess = await handleDrawMessage(message);
    if (handledDrawGuess) return;
    await handlePrefixGame(message, command);
  } catch (error) {
    console.error('[prefix]', error);
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.premiumSince || !newMember.premiumSince) return;
  const channelId = process.env.POST_CHANNEL_ID;
  if (!channelId) return;
  const channel = await newMember.guild.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send(`**${newMember} احلا من يحط البوست🌹**`).catch(() => {});
});

process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

await client.login(token);
