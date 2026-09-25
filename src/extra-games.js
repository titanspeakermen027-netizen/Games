import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { activeGames, canRunGroup } from "./games-engine.js";
import {
  getGuildSettings,
  recordGame,
  isGroupGameChannelAllowed,
} from "./store.js";
import { sendElimination } from "./elimination-stickers.js";

export const EXTRA_GROUP_GAMES = new Set(["bomb", "mine", "connect", "riddle"]);
export const EXTRA_SOLO_GAMES = new Set([
  "letters",
  "solid",
  "wordsolo",
  "chain",
  "capitals",
  "singular",
  "plural",
  "number",
  "math",
]);

export const EXTRA_GAME_NAMES = {
  bomb: "بومب",
  mine: "لغم",
  connect: "وصل",
  riddle: "لغز",
  letters: "حروف",
  solid: "جماد",
  wordsolo: "كلمة",
  chain: "اشبك",
  capitals: "عواصم",
  singular: "مفرد",
  plural: "جمع",
  number: "رقم",
  math: "حساب",
};

export const EXTRA_PREFIX_ALIASES = {
  "-بومب": "bomb",
  "-لغم": "mine",
  "-mine": "mine",
  "-bomb": "bomb",
  "-وصل": "connect",
  "-connect": "connect",
  "-لغز": "riddle",
  "-riddle": "riddle",

  ".حروف": "letters",
  ".جماد": "solid",
  ".كلمة": "wordsolo",
  ".اشبك": "chain",
  ".أشبك": "chain",
  ".عواصم": "capitals",
  ".مفرد": "singular",
  ".جمع": "plural",
  ".رقم": "number",
  ".حساب": "math",
};

export function isExtraGame(gameId) {
  return EXTRA_GROUP_GAMES.has(gameId) || EXTRA_SOLO_GAMES.has(gameId);
}

const random = array => array[Math.floor(Math.random() * array.length)];
const shuffle = array => [...array].sort(() => Math.random() - 0.5);
const keygen = () => Math.random().toString(36).slice(2, 10);

const GROUP_MIN_PLAYERS = {
  bomb: 4,
  mine: 4,
  connect: 2,
  riddle: 2,
};

function safeReply(source, payload) {
  if (source.replied || source.deferred) return source.followUp(payload).catch(() => {});
  return source.reply(payload).catch(() => {});
}

function memberForSource(source) {
  return source.member || source.guild?.members?.cache?.get(source.user?.id || source.author?.id) || null;
}

function extraLobbyComponents(state, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("extra:lobby:" + state.key + ":join")
        .setLabel("انضمام")
        .setEmoji("🎮")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("extra:lobby:" + state.key + ":start")
        .setLabel("بدء")
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("extra:lobby:" + state.key + ":cancel")
        .setLabel("إلغاء")
        .setEmoji("✖️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
    ),
  ];
}

function lobbyEmbed(state) {
  const min = GROUP_MIN_PLAYERS[state.id] || 2;
  return new EmbedBuilder()
    .setTitle("🎮 فعالية " + EXTRA_GAME_NAMES[state.id])
    .setDescription([
      "منظم الفعالية: <@" + state.hostId + ">",
      "",
      "**اللاعبون (" + state.players.length + "/" + state.maxPlayers + "):**",
      state.players.length
        ? state.players.map(id => "• <@" + id + ">").join("\n")
        : "• لا يوجد لاعبون بعد.",
      "",
      "الحد الأدنى: **" + min + "**",
      "الفائز: **" + state.winnerPoints + " نقطة**",
    ].join("\n"))
    .setFooter({
      text: "تبدأ تلقائياً بعد " + state.lobbySeconds + " ثانية عند اكتمال الحد الأدنى.",
    });
}

function minPlayers(id) {
  return GROUP_MIN_PLAYERS[id] || 2;
}

async function createExtraGroupLobby(source, gameId) {
  const settings = getGuildSettings(source.guildId);
  const member = memberForSource(source);

  if (!canRunGroup(member, settings)) {
    return safeReply(source, {
      content: "⛔ الألعاب الجماعية تحتاج صلاحية الإدارة أو رتبة رئيس الفعاليات.",
      ephemeral: true,
    });
  }

  if (!isGroupGameChannelAllowed(source.guildId, source.channelId)) {
    return safeReply(source, {
      content: "🚫 هذا الروم غير مسموح فيه بتشغيل الفعاليات الجماعية.",
      ephemeral: true,
    });
  }

  if (activeGames.has(source.channelId)) {
    return safeReply(source, {
      content: "⚠️ توجد لعبة أو فعالية نشطة في هذه القناة.",
      ephemeral: true,
    });
  }

  const state = {
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
    message: null,
    currentRound: null,
  };

  activeGames.set(state.channelId, state);

  if (source.isChatInputCommand?.()) {
    await source.reply({
      embeds: [lobbyEmbed(state)],
      components: extraLobbyComponents(state),
    });
    state.message = await source.fetchReply().catch(() => null);
  } else {
    state.message = await source.channel
      .send({ embeds: [lobbyEmbed(state)], components: extraLobbyComponents(state) })
      .catch(() => null);
  }

  if (!state.message) {
    activeGames.delete(state.channelId);
    return;
  }

  state.timeout = setTimeout(() => autoStartExtraGroup(state).catch(console.error), state.lobbySeconds * 1000);
}

async function autoStartExtraGroup(state) {
  if (state.cancelled || state.finished || state.started || !activeGames.has(state.channelId)) return;

  if (state.players.length < minPlayers(state.id)) {
    activeGames.delete(state.channelId);
    clearTimeout(state.timeout);
    await state.message?.edit({
      embeds: [
        lobbyEmbed(state).setDescription(
          lobbyEmbed(state).data.description + "\n\n⏱️ انتهى الوقت ولم يكتمل العدد، وتم إلغاء الفعالية.",
        ),
      ],
      components: [],
    }).catch(() => {});
    return;
  }

  await startExtraGroup(state, state.message?.channel);
}

async function startExtraGroup(state, channel) {
  if (state.started || state.finished || state.cancelled) return;
  state.started = true;
  clearTimeout(state.timeout);
  await state.message?.edit({ components: extraLobbyComponents(state, true) }).catch(() => {});
  if (state.id === "bomb" || state.id === "mine") return playBomb(channel, state);
  if (state.id === "connect") return playConnect(channel, state);
  if (state.id === "riddle") return playRiddle(channel, state);
  return finishExtra(state, channel, [], "تعذر تشغيل الفعالية.");
}

async function finishExtra(state, channel, winners = [], details = null) {
  if (state.finished) return;
  state.finished = true;
  clearTimeout(state.timeout);
  activeGames.delete(state.channelId);

  for (const id of state.players) {
    recordGame(
      state.guildId,
      id,
      winners.includes(id),
      winners.includes(id) ? state.winnerPoints : 0,
    );
  }

  const result = details
    || (winners.length
      ? "🏆 الفائز: " + winners.map(id => "<@" + id + ">").join("، ")
      : "⏱️ انتهت الفعالية بلا فائز.");

  await channel?.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏁 " + EXTRA_GAME_NAMES[state.id] + " انتهت")
        .setDescription(
          result +
          (winners.length
            ? "\n\n🎖️ كل فائز حصل على **" + state.winnerPoints + " نقطة**."
            : "\n\nلم تُحتسب نقاط."),
        ),
    ],
  }).catch(() => {});
}

function bombButtons(roundKey, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      [0, 1, 2, 3, 4].map(slot =>
        new ButtonBuilder()
          .setCustomId("extra:bomb:" + roundKey + ":" + slot)
          .setLabel(String(slot + 1))
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("💣")
          .setDisabled(disabled),
      ),
    ),
  ];
}

async function playBomb(channel, state) {
  const title = state.id === "mine" ? "⛏️ لغم" : "💣 بومب";
  let alive = [...state.players];

  while (alive.length > 1 && !state.cancelled) {
    const roundKey = keygen();
    const bombSlot = Math.floor(Math.random() * 5);
    const picks = new Map();

    state.currentRound = {
      type: "bomb",
      key: roundKey,
      alive: [...alive],
      bombSlot,
      picks,
      resolve: null,
      message: null,
    };

    const roundMessage = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(
            "كل لاعب يختار صندوقاً واحداً.\n" +
            "صندوق واحد فقط فيه اللغم.\n\n" +
            "المختارون: **0/" + alive.length + "**",
          ),
      ],
      components: bombButtons(roundKey),
    });

    state.currentRound.message = roundMessage;

    await new Promise(resolve => {
      state.currentRound.resolve = resolve;
      state.currentRound.timer = setTimeout(resolve, 15000);
    });

    clearTimeout(state.currentRound.timer);
    if (state.cancelled) break;

    for (const id of alive) {
      if (!picks.has(id)) picks.set(id, Math.floor(Math.random() * 5));
    }

    const eliminated = alive.filter(id => picks.get(id) === bombSlot);
    if (!eliminated.length) eliminated.push(random(alive));

    for (const id of eliminated) {
      await sendElimination(channel, id, "ضغط على اللغم وخرج من اللعبة.");
    }

    alive = alive.filter(id => !eliminated.includes(id));

    await roundMessage.edit({
      embeds: [
        new EmbedBuilder()
          .setTitle("💥 نتيجة بومب")
          .setDescription(
            "خرج من الجولة: " +
            eliminated.map(id => "<@" + id + ">").join("، ") +
            "\n\nالمتبقون: **" + alive.length + "**",
          ),
      ],
      components: bombButtons(roundKey, true),
    }).catch(() => {});
  }

  state.currentRound = null;
  await finishExtra(
    state,
    channel,
    alive.length ? [alive[0]] : [],
    alive.length ? "🏆 الناجي الأخير: <@" + alive[0] + ">" : "لم يتبق أي لاعب.",
  );
}

function connectBoard(board) {
  const rows = [];
  for (let row = 0; row < 6; row++) {
    const values = [];
    for (let col = 0; col < 7; col++) {
      const value = board[row * 7 + col];
      values.push(value === "A" ? "🔴" : value === "B" ? "🔵" : "⚪");
    }
    rows.push(values.join(" "));
  }
  return rows.join("\n");
}

function connectButtons(state, disabled = false) {
  const round = state.currentRound;
  const blocked = disabled || !round || round.done;
  const rows = [
    [0, 1, 2, 3, 4],
    [5, 6],
  ];

  return rows.map(cols =>
    new ActionRowBuilder().addComponents(
      cols.map(col =>
        new ButtonBuilder()
          .setCustomId("extra:connect:" + round.key + ":" + col)
          .setLabel(String(col + 1))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(blocked || round.fullColumns.includes(col)),
      ),
    ),
  );
}

function connectWinner(board, piece) {
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      if (board[row * 7 + col] !== piece) continue;
      for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        let count = 1;
        for (let step = 1; step < 4; step++) {
          const r = row + dr * step;
          const c = col + dc * step;
          if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r * 7 + c] !== piece) break;
          count++;
        }
        for (let step = 1; step < 4; step++) {
          const r = row - dr * step;
          const c = col - dc * step;
          if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r * 7 + c] !== piece) break;
          count++;
        }
        if (count >= 4) return true;
      }
    }
  }
  return false;
}

function dropConnectPiece(round, column) {
  for (let row = 5; row >= 0; row--) {
    const index = row * 7 + column;
    if (round.board[index]) continue;
    round.board[index] = round.turn === 0 ? "A" : "B";
    round.fullColumns = [];
    for (let col = 0; col < 7; col++) {
      if (round.board[col]) round.fullColumns.push(col);
    }
    return round.turn++;
  }
  return null;
}

async function updateConnectMessage(message, state) {
  const round = state.currentRound;
  if (!round) return;
  const currentId = round.players[round.turn];
  await message.edit({
    embeds: [
      new EmbedBuilder()
        .setTitle("🔴🔵 وصل")
        .setDescription(
          "🔴 <@" + round.players[0] + ">\n" +
          "🔵 <@" + round.players[1] + ">\n\n" +
          connectBoard(round.board) +
          "\n\n" +
          (round.done ? "🏁 انتهت المباراة." : "الدور: <@" + currentId + ">"),
        ),
    ],
    components: connectButtons(state),
  }).catch(() => {});
}

async function playConnect(channel, state) {
  const players = state.players.slice(0, 2);
  if (players.length < 2) return finishExtra(state, channel);

  const roundKey = keygen();
  const round = {
    type: "connect",
    key: roundKey,
    board: Array(42).fill(null),
    turn: 0,
    players,
    done: false,
    fullColumns: [],
    resolve: null,
    timer: null,
  };

  state.currentRound = round;

  const message = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🔴🔵 وصل")
        .setDescription(
          "اربط 4 قطع متتالية.\n" +
          "🔴 <@" + players[0] + ">\n" +
          "🔵 <@" + players[1] + ">\n\n" +
          connectBoard(round.board) +
          "\n\nالدور: <@" + players[0] + ">",
        ),
    ],
    components: connectButtons(state),
  });

  while (!state.finished && !state.cancelled && !round.done) {
    const result = await new Promise(resolve => {
      round.resolve = resolve;
      round.timer = setTimeout(() => resolve("timeout"), 30000);
    });

    clearTimeout(round.timer);
    if (state.finished || state.cancelled || round.done) break;

    // A normal button move was already applied by handleConnectButton.
    // Only the inactivity timeout performs an automatic move.
    if (result === "move") continue;

    const playerIndex = round.turn;
    const available = [];
    for (let col = 0; col < 7; col++) {
      if (!round.fullColumns.includes(col)) available.push(col);
    }
    if (!available.length) {
      round.done = true;
      await updateConnectMessage(message, state);
      break;
    }

    const chosen = random(available);
    const piece = playerIndex === 0 ? "A" : "B";
    dropConnectPiece(round, chosen);

    if (connectWinner(round.board, piece)) {
      round.done = true;
      await message.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 وصل")
            .setDescription(connectBoard(round.board) + "\n\n🏆 الفائز: <@" + players[playerIndex] + ">"),
        ],
        components: connectButtons(state, true),
      }).catch(() => {});
      await finishExtra(state, channel, [players[playerIndex]]);
      break;
    }

    if (round.board.every(Boolean)) {
      round.done = true;
      await message.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤝 وصل")
            .setDescription(connectBoard(round.board) + "\n\nانتهت المباراة بالتعادل."),
        ],
        components: connectButtons(state, true),
      }).catch(() => {});
      await finishExtra(state, channel, [], "🤝 انتهت المباراة بالتعادل.");
      break;
    }

    await updateConnectMessage(message, state);
  }
}

async function handleConnectButton(interaction, state, roundKey, column) {
  const round = state.currentRound;
  if (!round || round.type !== "connect" || round.key !== roundKey || round.done) {
    await safeReply(interaction, { content: "هذه الجولة انتهت.", ephemeral: true });
    return;
  }

  const playerIndex = round.turn;
  const currentUser = round.players[playerIndex];
  if (interaction.user.id !== currentUser) {
    await safeReply(interaction, { content: "ليس دورك الآن.", ephemeral: true });
    return;
  }

  const col = Number(column);
  if (!Number.isInteger(col) || col < 0 || col > 6 || round.fullColumns.includes(col)) {
    await safeReply(interaction, { content: "هذا العمود ممتلئ.", ephemeral: true });
    return;
  }

  const piece = playerIndex === 0 ? "A" : "B";
  dropConnectPiece(round, col);

  if (connectWinner(round.board, piece)) {
    round.done = true;
    round.resolve?.("winner");
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 وصل")
          .setDescription(connectBoard(round.board) + "\n\n🏆 الفائز: " + interaction.user.mention),
      ],
      components: connectButtons(state, true),
    }).catch(() => {});
    await finishExtra(state, interaction.channel, [interaction.user.id]);
    return;
  }

  if (round.board.every(Boolean)) {
    round.done = true;
    round.resolve?.("draw");
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("🤝 وصل")
          .setDescription(connectBoard(round.board) + "\n\nانتهت المباراة بالتعادل."),
      ],
      components: connectButtons(state, true),
    }).catch(() => {});
    await finishExtra(state, interaction.channel, [], "🤝 انتهت المباراة بالتعادل.");
    return;
  }

  round.resolve?.("move");
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle("🔴🔵 وصل")
        .setDescription(
          "🔴 <@" + round.players[0] + ">\n" +
          "🔵 <@" + round.players[1] + ">\n\n" +
          connectBoard(round.board) +
          "\n\nالدور: <@" + round.players[round.turn] + ">",
        ),
    ],
    components: connectButtons(state),
  }).catch(() => {});
}

async function playRiddle(channel, state) {
  const riddles = [
    { q: "شيء كلما أخذت منه كبر، ما هو؟", a: ["الحفرة", "حفره"] },
    { q: "ما هو الشيء الذي له أسنان ولا يعض؟", a: ["المشط"] },
    { q: "شيء يمشي بلا رجلين ويبكي بلا عينين، ما هو؟", a: ["السحاب", "السحابة"] },
    { q: "ما هو الشيء الذي إذا زاد نقص؟", a: ["العمر"] },
    { q: "ما هو الشيء الذي نراه في الليل ثلاث مرات وفي النهار مرة؟", a: ["حرف اللام", "اللام"] },
  ];

  const riddle = random(riddles);
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🧩 لغز")
        .setDescription(riddle.q + "\n\n⏱️ أمامكم 20 ثانية."),
    ],
  });

  const winner = await new Promise(resolve => {
    const collector = channel.createMessageCollector({
      time: 20000,
      filter: message =>
        state.players.includes(message.author.id) &&
        !message.author.bot,
    });

    collector.on("collect", message => {
      const answer = message.content.trim().toLowerCase();
      if (!riddle.a.some(item => item.toLowerCase() === answer)) return;
      collector.stop("winner");
      resolve(message.author.id);
    });

    collector.once("end", (_, reason) => {
      if (reason !== "winner") resolve(null);
    });
  });

  if (winner) {
    return finishExtra(state, channel, [winner], "🏆 <@" + winner + "> حل اللغز أولاً بشكل صحيح.");
  }

  return finishExtra(state, channel, [], "⏱️ انتهى الوقت. الإجابة: **" + riddle.a[0] + "**");
}

const ARABIC_LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش",
  "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];

const SOLO_WORDS = [
  "كتاب", "مدرسة", "سيارة", "حاسوب", "هاتف", "حديقة", "بحر", "قمر", "لاعب",
  "كرة", "برمجة", "مغرب", "صديق", "مدينة", "مطار", "مكتبة", "روبوت",
];

const OBJECTS = [
  "كرسي", "كتاب", "قلم", "هاتف", "مفتاح", "طاولة", "باب", "مصباح", "حقيبة",
  "حاسوب", "مرآة", "ساعة", "مقص", "مظلة",
];

const CAPITALS = {
  "المغرب": "الرباط",
  "فرنسا": "باريس",
  "إسبانيا": "مدريد",
  "البرتغال": "لشبونة",
  "إيطاليا": "روما",
  "اليابان": "طوكيو",
  "مصر": "القاهرة",
  "السعودية": "الرياض",
  "الجزائر": "الجزائر",
  "تونس": "تونس",
};

const SINGULAR = {
  "كتب": "كتاب",
  "أقلام": "قلم",
  "سيارات": "سيارة",
  "هواتف": "هاتف",
  "لاعبون": "لاعب",
  "مدارس": "مدرسة",
};

const PLURAL = {
  "كتاب": "كتب",
  "قلم": "أقلام",
  "سيارة": "سيارات",
  "هاتف": "هواتف",
  "لاعب": "لاعبون",
  "مدرسة": "مدارس",
};

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function runSoloExtra(channel, guildId, gameId, starterId, source) {
  const settings = getGuildSettings(guildId);
  if (settings.individualGameChannelId && settings.individualGameChannelId !== channel.id) {
    return safeReply(source, {
      content: "🚫 الألعاب الفردية مخصصة لروم أخرى في هذا السيرفر.",
      ephemeral: true,
    });
  }

  if (activeGames.has(channel.id)) {
    return safeReply(source, {
      content: "⚠️ توجد لعبة نشطة بالفعل في هذه القناة.",
      ephemeral: true,
    });
  }

  let prompt = "";
  let answers = [];
  const title = EXTRA_GAME_NAMES[gameId];

  if (gameId === "letters") {
    const letter = random(ARABIC_LETTERS);
    const options = SOLO_WORDS.filter(word => word.startsWith(letter));
    prompt = "🎯 اكتب كلمة تبدأ بحرف **" + letter + "**.";
    answers = options.length ? options : SOLO_WORDS;
  } else if (gameId === "solid") {
    const letter = random(ARABIC_LETTERS);
    const options = OBJECTS.filter(word => word.startsWith(letter));
    prompt = "🧱 اذكر جماداً يبدأ بحرف **" + letter + "**.";
    answers = options.length ? options : OBJECTS;
  } else if (gameId === "wordsolo") {
    const word = random(SOLO_WORDS);
    const shuffled = shuffle([...word]).join("");
    prompt = "🔤 رتب الحروف لتكوين الكلمة: **" + shuffled + "**.";
    answers = [word];
  } else if (gameId === "chain") {
    const letter = random(["م", "س", "ك", "ب"]);
    prompt = "🔗 اشبك: اكتب كلمة تحتوي على الحرف **" + letter + "** وتكون من 4 أحرف على الأقل.";
    answers = null;
  } else if (gameId === "capitals") {
    const country = random(Object.keys(CAPITALS));
    prompt = "🌍 ما عاصمة **" + country + "**؟";
    answers = [CAPITALS[country]];
  } else if (gameId === "singular") {
    const value = random(Object.keys(SINGULAR));
    prompt = "📚 ما مفرد **" + value + "**؟";
    answers = [SINGULAR[value]];
  } else if (gameId === "plural") {
    const value = random(Object.keys(PLURAL));
    prompt = "📚 ما جمع **" + value + "**؟";
    answers = [PLURAL[value]];
  } else if (gameId === "number") {
    const start = 2 + Math.floor(Math.random() * 8);
    const step = 2 + Math.floor(Math.random() * 5);
    const expected = start + step * 3;
    prompt =
      "🔢 أكمل المتتالية: **" +
      start + "، " + (start + step) + "، " + (start + step * 2) + "، ؟**";
    answers = [String(expected)];
  } else if (gameId === "math") {
    const a = 5 + Math.floor(Math.random() * 20);
    const b = 2 + Math.floor(Math.random() * 15);
    const op = random(["+", "-", "×"]);
    let expected = 0;
    if (op === "+") expected = a + b;
    if (op === "-") expected = a - b;
    if (op === "×") expected = a * b;
    prompt = "🧮 احسب: **" + a + " " + op + " " + b + " = ؟**";
    answers = [String(expected)];
  }

  const payload = {
    embeds: [
      new EmbedBuilder()
        .setTitle("🎮 " + title)
        .setDescription(prompt + "\n\n⏱️ أمامكم 15 ثانية."),
    ],
  };

  if (source?.isChatInputCommand?.()) await source.reply(payload);
  else await channel.send(payload);

  const state = {
    id: gameId,
    key: keygen(),
    guildId,
    channelId: channel.id,
    starterId,
    finished: false,
  };
  activeGames.set(channel.id, state);

  const collector = channel.createMessageCollector({
    time: 15000,
    filter: message => !message.author.bot && message.guild?.id === guildId,
  });

  collector.on("collect", message => {
    if (state.finished) return;
    const value = normalize(message.content);
    const valid = gameId === "chain"
      ? value.length >= 4 && /[مسكب]/.test(value)
      : answers.some(answer => normalize(answer) === value);
    if (!valid) return;

    state.finished = true;
    activeGames.delete(channel.id);
    collector.stop("winner");
    channel.send(
      "🏆 <@" + message.author.id + "> أجاب بشكل صحيح في **" + title + "**.\n🎮 لعبة فردية — بدون نقاط.",
    ).catch(() => {});
  });

  collector.once("end", (_, reason) => {
    if (reason === "winner" || state.finished) return;
    activeGames.delete(channel.id);
    channel.send("⏱️ انتهى الوقت في لعبة **" + title + "** بلا فائز.").catch(() => {});
  });
}

export async function handleExtraGameCommand(source, gameId) {
  if (!isExtraGame(gameId)) return false;
  if (EXTRA_GROUP_GAMES.has(gameId)) {
    await createExtraGroupLobby(source, gameId);
  } else {
    await runSoloExtra(
      source.channel,
      source.guildId,
      gameId,
      source.user?.id || source.author?.id,
      source,
    );
  }
  return true;
}

export async function handleExtraPrefix(message) {
  if (!message.guild || message.author.bot) return false;
  const command = message.content.trim().split(/\s+/)[0];
  const gameId = EXTRA_PREFIX_ALIASES[command];
  if (!gameId) return false;

  if (EXTRA_GROUP_GAMES.has(gameId)) {
    await createExtraGroupLobby(message, gameId);
  } else {
    await runSoloExtra(
      message.channel,
      message.guild.id,
      gameId,
      message.author.id,
      message,
    );
  }
  return true;
}

export async function handleExtraButton(interaction) {
  if (!interaction.isButton?.()) return false;
  if (!interaction.customId.startsWith("extra:")) return false;

  const parts = interaction.customId.split(":");
  const kind = parts[1];
  const key = parts[2];
  const action = parts[3];
  const state = activeGames.get(interaction.channelId);

  if (!state) {
    await safeReply(interaction, { content: "لا توجد لعبة نشطة.", ephemeral: true });
    return true;
  }

  if (kind === "lobby") {
    if (state.key !== key || state.started || state.finished) {
      await safeReply(interaction, { content: "انتهت الفعالية أو لم تعد متاحة.", ephemeral: true });
      return true;
    }

    if (action === "join") {
      if (state.players.includes(interaction.user.id)) {
        await safeReply(interaction, { content: "أنت منضم بالفعل.", ephemeral: true });
        return true;
      }
      if (state.players.length >= state.maxPlayers) {
        await safeReply(interaction, { content: "وصلنا للحد الأقصى من اللاعبين.", ephemeral: true });
        return true;
      }
      state.players.push(interaction.user.id);
      await interaction.update({
        embeds: [lobbyEmbed(state)],
        components: extraLobbyComponents(state),
      });
      return true;
    }

    if (action === "start" || action === "cancel") {
      const settings = getGuildSettings(state.guildId);
      if (interaction.user.id !== state.hostId && !canRunGroup(interaction.member, settings)) {
        await safeReply(interaction, { content: "غير مسموح لك بهذا الإجراء.", ephemeral: true });
        return true;
      }

      if (action === "start") {
        if (state.players.length < minPlayers(state.id)) {
          await safeReply(interaction, {
            content: "خاصكم على الأقل " + minPlayers(state.id) + " لاعبين.",
            ephemeral: true,
          });
          return true;
        }
        await interaction.deferUpdate();
        await startExtraGroup(state, interaction.channel);
        return true;
      }

      state.cancelled = true;
      clearTimeout(state.timeout);
      activeGames.delete(state.channelId);
      await interaction.update({
        embeds: [lobbyEmbed(state).setDescription("🛑 تم إلغاء الفعالية.")],
        components: [],
      });
      return true;
    }
  }

  if (kind === "bomb") {
    if (state.id !== "bomb") return true;
    const round = state.currentRound;
    const slot = Number(action);

    if (!round || round.key !== key || !round.alive.includes(interaction.user.id)) {
      await safeReply(interaction, { content: "هذه الجولة ليست متاحة لك.", ephemeral: true });
      return true;
    }

    if (round.picks.has(interaction.user.id)) {
      await safeReply(interaction, { content: "تم تسجيل اختيارك من قبل.", ephemeral: true });
      return true;
    }

    if (!Number.isInteger(slot) || slot < 0 || slot > 4) {
      await safeReply(interaction, { content: "اختيار غير صالح.", ephemeral: true });
      return true;
    }

    round.picks.set(interaction.user.id, slot);
    await interaction.reply({ content: "✅ تم تسجيل اختيارك.", ephemeral: true }).catch(() => {});
    await round.message?.edit({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(
            "تم تسجيل: **" + round.picks.size + "/" + round.alive.length + "** لاعبين.",
          ),
      ],
      components: bombButtons(round.key),
    }).catch(() => {});

    if (round.picks.size >= round.alive.length) round.resolve?.();
    return true;
  }

  if (kind === "connect") {
    await handleConnectButton(interaction, state, key, action);
    return true;
  }

  return true;
}
