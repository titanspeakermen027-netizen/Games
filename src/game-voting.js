import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

import {
  GAME_NAMES,
  GROUP_GAMES,
  startGroupGame,
} from './games-engine.js';
import { canRunGroup } from './games-engine.js';
import { getGuildSettings, isGroupGameChannelAllowed } from './store.js';

const VOTE_SECONDS = 30;

export class GameVoting {
  constructor() {
    this.sessions = new Map();
  }

  async handleMessage(message) {
    if (!message.guild || message.author.bot || message.content.trim() !== '-تصويت') return false;
    if (!isGroupGameChannelAllowed(message.guildId, message.channelId)) {
      await message.reply('❌ هاد الروم ما مسموحش فيها التصويت على الفعاليات.').catch(() => {});
      return true;
    }

    if (!canRunGroup(message.member, getGuildSettings(message.guildId))) {
      await message.reply('⛔ غير الإدارة أو رئيس الفعاليات يقدرو يفتحو تصويت على الألعاب الجماعية.').catch(() => {});
      return true;
    }

    const key = String(message.channelId);
    if (this.sessions.has(key)) {
      await message.reply('❌ كاين تصويت مفتوح بالفعل فهاد الروم.').catch(() => {});
      return true;
    }

    const games = [...GROUP_GAMES];
    const voteKey = Math.random().toString(36).slice(2, 10);
    const votes = new Map();

    const embed = () => {
      const counts = new Map(games.map(id => [id, 0]));
      for (const gameId of votes.values()) counts.set(gameId, (counts.get(gameId) || 0) + 1);
      const lines = games.map((id, index) => `**${index + 1}.** ${GAME_NAMES[id]} — **${counts.get(id) || 0}** صوت`);
      return new EmbedBuilder()
        .setTitle('🗳️ التصويت على اللعبة الجماعية')
        .setDescription([
          'اختار لعبة واحدة من القائمة.',
          '',
          ...lines,
          '',
          `⏱️ ينتهي التصويت خلال **${VOTE_SECONDS} ثانية**`,
          `👥 عدد المصوتين: **${votes.size}**`,
        ].join('\\n'));
    };

    const menu = () => new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`gamesvote:${voteKey}`)
        .setPlaceholder('اختر اللعبة...')
        .addOptions(games.map(id => ({
          label: GAME_NAMES[id].slice(0, 100),
          value: id,
          description: `التصويت على ${GAME_NAMES[id]}`.slice(0, 100),
        }))),
    );

    const sent = await message.channel.send({ embeds: [embed()], components: [menu()] }).catch(() => null);
    if (!sent) return true;

    const session = { voteKey, channelId: message.channelId, guildId: message.guildId, source: message, message: sent, votes, games, embed, menu };
    this.sessions.set(key, session);

    session.timer = setTimeout(async () => {
      await this.finish(session);
    }, VOTE_SECONDS * 1000);

    return true;
  }

  async handleInteraction(interaction) {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('gamesvote:')) return false;

    const voteKey = interaction.customId.slice('gamesvote:'.length);
    const session = this.sessions.get(String(interaction.channelId));
    if (!session || session.voteKey !== voteKey) {
      await interaction.reply({ content: '❌ هاد التصويت سالا أو ما بقاش متاح.', ephemeral: true }).catch(() => {});
      return true;
    }

    if (session.votes.has(interaction.user.id)) {
      await interaction.reply({ content: '⚠️ سبق ليك صوتي فهاد التصويت، وما يمكنش تبدل التصويت.', ephemeral: true }).catch(() => {});
      return true;
    }

    session.votes.set(interaction.user.id, interaction.values[0]);
    await interaction.update({ embeds: [session.embed()], components: [session.menu()] }).catch(() => {});
    return true;
  }

  async finish(session) {
    if (!this.sessions.delete(String(session.channelId))) return;
    clearTimeout(session.timer);

    const counts = new Map(session.games.map(id => [id, 0]));
    for (const gameId of session.votes.values()) counts.set(gameId, (counts.get(gameId) || 0) + 1);

    await session.message.edit({ embeds: [session.embed().setFooter({ text: 'انتهى التصويت.' })], components: [] }).catch(() => {});

    if (!session.votes.size) {
      await session.message.channel.send('❌ سالا التصويت بلا حتى صوت.').catch(() => {});
      return;
    }

    const highest = Math.max(...session.games.map(id => counts.get(id) || 0));
    const tied = session.games.filter(id => (counts.get(id) || 0) === highest);
    const winner = tied[Math.floor(Math.random() * tied.length)];

    await session.message.channel.send(
      `🗳️ انتهى التصويت باختيار **${GAME_NAMES[winner]}**. غادي تبدا الفعالية دابا.`,
    ).catch(() => {});

    await startGroupGame(session.source, winner);
  }
}
