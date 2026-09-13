import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  handleGameCommand,
  handleButton,
  handleModal,
  activeGames,
  cancelActiveGame,
} from './games-engine.js';
import { initDatabase } from './store.js';

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
  ['country', 'خمّن الدولة'], ['draw', 'خمّن الرسمة'], ['word', 'خمّن الكلمة'], ['wheel', 'العجلة'],
  ['button', 'زر'], ['fast', 'أسرع'], ['split', 'فكك'], ['merge', 'ادمج'], ['flag', 'أعلام'],
  ['reverse', 'اعكس'], ['letter', 'حرف'], ['correct', 'صحح'], ['sort', 'ترتيب'], ['colors', 'ألوان'],
  ['emoji', 'إيموجي'], ['reveal', 'اكشف'],
];

const play = new SlashCommandBuilder()
  .setName('لعب')
  .setDescription('ابدأ إحدى ألعاب البوت')
  .addStringOption(option => {
    option.setName('اللعبة').setDescription('اختر اللعبة').setRequired(true);
    for (const [value, name] of choices) option.addChoices({ name, value });
    return option;
  });

const stop = new SlashCommandBuilder()
  .setName('إيقاف-اللعبة')
  .setDescription('إيقاف اللعبة الحالية في القناة')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

const rest = new REST({ version: '10' }).setToken(token);
await rest.put(
  guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId),
  { body: [play, stop].map(command => command.toJSON()) },
);

client.once('ready', () => {
  console.log(`✅ تم تسجيل الدخول باسم ${client.user.tag}`);
  client.user.setActivity('ألعاب ديسكورد | /لعب');
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'لعب') {
        await handleGameCommand(interaction, interaction.options.getString('اللعبة', true));
      } else if (interaction.commandName === 'إيقاف-اللعبة') {
        const stopped = await cancelActiveGame(interaction.channelId);
        await interaction.reply({
          content: stopped ? '✅ تم إيقاف اللعبة الحالية بنجاح.' : 'لا توجد لعبة نشطة في هذه القناة.',
          ephemeral: true,
        });
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
    const payload = { content: 'حدث خطأ غير متوقع أثناء تشغيل اللعبة. يرجى المحاولة مرة أخرى.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
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
