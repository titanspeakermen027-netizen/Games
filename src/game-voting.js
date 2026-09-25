import { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } from "discord.js";
import { startGroupGame } from "./games-engine.js";
import { EXTRA_GROUP_GAMES, EXTRA_GAME_NAMES, handleExtraGameCommand } from "./extra-games.js";
import { isGroupGameChannelAllowed } from "./store.js";

export const VOTE_SECONDS = 60;

const VOTE_OPTIONS = [
  ["wheel", "روليت"],
  ["mafia", "مافيا"],
  ["hide", "هايد"],
  ["bomb", "بومب"],
  ["rps", "حجرة"],
  ["xo", "اكس او"],
  ["chairs", "كراسي"],
  ["dice", "نرد"],
  ["connect", "وصل"],
  ["riddle", "لغم"],
];

class VoteSession {
  constructor(guildId, channelId) {
    this.guildId = guildId;
    this.channelId = channelId;
    this.votes = new Map();
    this.message = null;
  }
}

function buildEmbed(session) {
  const counts = new Map(VOTE_OPTIONS.map(([id]) => [id, 0]));
  for (const id of session.votes.values()) counts.set(id, (counts.get(id) || 0) + 1);

  return new EmbedBuilder()
    .setTitle("Game Vote")
    .setDescription(
      "يرجى التصويت على اللعبة المراد تشغيلها.\n\n" +
      VOTE_OPTIONS.map(([id, name]) => "• " + name + ": **" + counts.get(id) + "**").join("\n"),
    )
    .setFooter({
      text: "مدة التصويت: دقيقة • الأصوات: " + session.votes.size,
    });
}

function buildComponents() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("nawaf:game-vote")
    .setPlaceholder("يرجى التصويت على اللعبة المراد تشغيلها")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      VOTE_OPTIONS.map(([value, label], index) => ({
        label,
        value,
        emoji: index === 0 ? "🎡" : "🎮",
      })),
    );

  return [new ActionRowBuilder().addComponents(menu)];
}

async function launchWinner(message, gameId) {
  const owner = await message.guild.members.fetch(message.guild.ownerId).catch(() => null);
  if (!owner) return message.channel.send("❌ تعذر تشغيل اللعبة المختارة لأن مالك السيرفر غير متاح حالياً.");

  const source = {
    guild: message.guild,
    guildId: message.guild.id,
    channel: message.channel,
    channelId: message.channel.id,
    author: owner.user,
    user: owner.user,
    member: owner,
  };

  if (EXTRA_GROUP_GAMES.has(gameId)) {
    await handleExtraGameCommand(source, gameId);
  } else {
    await startGroupGame(source, gameId);
  }
}

export class GameVoting {
  constructor() {
    this.sessions = new Map();
  }

  buildEmbed(session) {
    return buildEmbed(session);
  }

  async handleInteraction(interaction) {
    if (!interaction.isStringSelectMenu?.() || interaction.customId !== "nawaf:game-vote") {
      return false;
    }

    const key = interaction.guildId + ":" + interaction.channelId;
    const session = this.sessions.get(key);
    if (!session) {
      await interaction.reply({ content: "❌ انتهى التصويت.", ephemeral: true }).catch(() => {});
      return true;
    }

    if (session.votes.has(interaction.user.id)) {
      await interaction.reply({
        content: "❌ لا يمكن التصويت مرة أخرى أو تغيير التصويت.",
        ephemeral: true,
      }).catch(() => {});
      return true;
    }

    const choice = interaction.values[0];
    if (!VOTE_OPTIONS.some(([id]) => id === choice)) {
      await interaction.reply({ content: "❌ اختيار غير صالح.", ephemeral: true }).catch(() => {});
      return true;
    }

    session.votes.set(interaction.user.id, choice);
    await interaction.update({
      embeds: [buildEmbed(session)],
      components: buildComponents(),
    }).catch(() => {});
    return true;
  }

  async onMessage(message) {
    if (message.author.bot || !message.guild || message.content.trim() !== "-تصويت") {
      return false;
    }

    if (!isGroupGameChannelAllowed(message.guild.id, message.channel.id)) {
      await message.reply({
        content: "❌ هاد الروم ما مسموحش فيه التصويت على الألعاب الجماعية.",
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
      return true;
    }

    const key = message.guild.id + ":" + message.channel.id;
    if (this.sessions.has(key)) {
      await message.reply({
        content: "❌ كاين تصويت مفتوح بالفعل.",
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
      return true;
    }

    const session = new VoteSession(message.guild.id, message.channel.id);
    this.sessions.set(key, session);

    session.message = await message.channel.send({
      embeds: [buildEmbed(session)],
      components: buildComponents(),
    });

    await new Promise(resolve => setTimeout(resolve, VOTE_SECONDS * 1000));

    try {
      if (!session.votes.size) {
        await message.channel.send("❌ انتهى التصويت بدون أي أصوات.");
        return true;
      }

      const counts = new Map(VOTE_OPTIONS.map(([id]) => [id, 0]));
      for (const id of session.votes.values()) counts.set(id, counts.get(id) + 1);
      const highest = Math.max(...counts.values());
      const tied = VOTE_OPTIONS.filter(([id]) => counts.get(id) === highest);
      const [winnerId, winnerName] = tied[Math.floor(Math.random() * tied.length)];

      await session.message.edit({
        embeds: [
          buildEmbed(session)
            .setTitle("Game Vote — انتهى")
            .setDescription(
              "انتهى التصويت.\n\nاللعبة المختارة: **" + winnerName + "**\n\n" +
              VOTE_OPTIONS.map(([id, name]) => "• " + name + ": **" + counts.get(id) + "**").join("\n"),
            ),
        ],
        components: [],
      }).catch(() => {});

      await message.channel.send(
        "🎮 انتهى التصويت، وستبدأ **" + winnerName + "** بعد قليل.",
      );
      await new Promise(resolve => setTimeout(resolve, 1500));
      await launchWinner(message, winnerId);
    } finally {
      this.sessions.delete(key);
    }

    return true;
  }
}
