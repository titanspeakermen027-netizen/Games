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
import { initDatabase, getGuildSettings, setGuildSettings, getPlayerStats, getLeaderboard } from './store.js';

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

const stats = new SlashCommandBuilder().setName('نقاطي').setDescription('عرض نقاطك وإحصائياتك في هذا السيرفر');
const leaderboard = new SlashCommandBuilder().setName('ترتيب-الألعاب').setDescription('عرض أفضل لاعبي الألعاب في هذا السيرفر');
const stop = new SlashCommandBuilder().setName('إيقاف-اللعبة').setDescription('إيقاف اللعبة الحالية في القناة');

const rest = new REST({ version: '10' }).setToken(token);
await rest.put(
  guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId),
  { body: [play, settings, stats, leaderboard, stop].map(command => command.toJSON()) },
);

client.once('ready', () => {
  console.log(`✅ تم تسجيل الدخول باسم ${client.user.tag}`);
  client.user.setActivity('ألعاب ديسكورد | .اسرع | -مافيا');
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

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'لعب') {
        await handleGameCommand(interaction, interaction.options.getString('اللعبة', true));
      } else if (interaction.commandName === 'إعدادات-الألعاب') {
        await handleSettingsCommand(interaction);
      } else if (interaction.commandName === 'نقاطي') {
        await handleStatsCommand(interaction);
      } else if (interaction.commandName === 'ترتيب-الألعاب') {
        await handleLeaderboardCommand(interaction);
      } else if (interaction.commandName === 'إيقاف-اللعبة') {
        const allowed = canRunGroup(interaction.member, getGuildSettings(interaction.guildId));
        if (!allowed) {
          await interaction.reply({ content: '⛔ غير مسموح لك بإيقاف اللعبة.', ephemeral: true });
          return;
        }
        const stopped = await cancelActiveGame(interaction.channelId);
        await interaction.reply({ content: stopped ? '✅ تم إيقاف اللعبة الحالية.' : 'ℹ️ لا توجد لعبة نشطة في هذه القناة.', ephemeral: true });
      }
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction);
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
  if (!command.startsWith('.') && !command.startsWith('-')) return;
  try {
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
