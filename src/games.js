import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { recordGame } from './store.js';

export const activeGames = new Map();
const timers = new Map();

const serverGames = new Set(['xo','mafia','chairs','rps','dice','hotxo','hide','replica','country','draw','word']);
const miniGames = new Set(['button','fast','split','merge','flag','reverse','letter','correct','sort','colors','emoji','reveal']);

const names = {
  xo:'XO', mafia:'مافيا', chairs:'كراسي', rps:'حجرة ورقة مقص', dice:'نرد', hotxo:'HotXO', hide:'غميضة', replica:'ريبلكا', country:'خمّن الدولة', draw:'خمّن الرسمة', word:'خمّن الكلمة',
  button:'زر', fast:'أسرع', split:'فكك', merge:'ادمج', flag:'أعلام', reverse:'اعكس', letter:'حرف', correct:'صحح', sort:'ترتيب', colors:'ألوان', emoji:'إيموجي', reveal:'اكشف'
};

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const mentionList = users => users.map(id => `• <@${id}>`).join('\n');

function joinRow(gameId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`game:${gameId}:join`).setLabel('انضمام').setEmoji('🎮').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`game:${gameId}:start`).setLabel('بدء').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`game:${gameId}:cancel`).setLabel('إلغاء').setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(disabled)
  );
}

export async function handleGameCommand(interaction, gameId) {
  if (!serverGames.has(gameId) && !miniGames.has(gameId)) {
    return interaction.reply({ content: 'هذه اللعبة غير متاحة.', ephemeral: true });
  }
  if (serverGames.has(gameId) && activeGames.has(interaction.channelId)) {
    return interaction.reply({ content: 'توجد لعبة نشطة بالفعل في هذه القناة.', ephemeral: true });
  }
  if (serverGames.has(gameId)) return startLobby(interaction, gameId);
  return startMini(interaction, gameId);
}

async function startLobby(interaction, gameId) {
  const state = { type:'server', id:gameId, channelId:interaction.channelId, guildId:interaction.guildId, players:[], cancelled:false, started:false };
  activeGames.set(interaction.channelId, state);
  await interaction.reply({ embeds:[lobbyEmbed(gameId, state.players)], components:[joinRow(gameId)] });
  const message = await interaction.fetchReply();
  state.messageId = message.id;
  timers.set(interaction.channelId, setTimeout(() => autoStart(interaction.channelId), 30000));
}

function lobbyEmbed(gameId, players) {
  return new EmbedBuilder()
    .setTitle(`🎮 ${names[gameId]}`)
    .setDescription(`ابدأ اللعبة بانضمام اللاعبين، ثم اضغط **بدء** عندما تكتمل المجموعة.\n\n**اللاعبون (${players.length}/20):**\n${players.length ? mentionList(players) : 'لا يوجد لاعبون بعد.'}`)
    .setFooter({ text:'سيبدأ اللوبي تلقائيًا بعد 30 ثانية إذا وصل إلى الحد الأدنى.' });
}

async function autoStart(channelId) {
  timers.delete(channelId);
  const state = activeGames.get(channelId);
  if (!state || state.started || state.cancelled) return;
  if (state.players.length < 2) {
    activeGames.delete(channelId);
    return state.channelId;
  }
  const channel = await stateGuildChannel(state);
  if (channel) await launchServerGame(channel, state);
}

async function stateGuildChannel(state) {
  const guild = global.clientGuilds?.get(state.guildId);
  return guild?.channels?.cache?.get(state.channelId) ?? null;
}

async function launchServerGame(channel, state) {
  state.started = true;
  clearTimeout(timers.get(state.channelId));
  timers.delete(state.channelId);
  switch (state.id) {
    case 'xo': return playXO(channel, state);
    case 'mafia': return playMafia(channel, state);
    case 'chairs': return playChairs(channel, state);
    case 'rps': return playRPS(channel, state);
    case 'dice': return playDice(channel, state);
    case 'hotxo': return playHotXO(channel, state);
    case 'hide': return playHide(channel, state);
    case 'replica': return playReplica(channel, state);
    case 'country': return playCountry(channel, state);
    case 'draw': return playDraw(channel, state);
    case 'word': return playWord(channel, state);
  }
}

async function finish(state, channel, winners = []) {
  if (state.finished) return;
  state.finished = true;
  activeGames.delete(state.channelId);
  const lines = winners.length ? winners.map(id => `<@${id}>`).join('، ') : 'لا يوجد فائز.';
  await channel.send({ embeds:[new EmbedBuilder().setTitle(`🏆 انتهت ${names[state.id]}`).setDescription(`الفائز: ${lines}`)] }).catch(()=>{});
  for (const id of state.players) recordGame(state.guildId, id, winners.includes(id), winners.includes(id) ? 10 : 0);
}

async function playXO(channel, state) {
  let players = state.players.slice(0, 20);
  const rounds = [];
  while (players.length > 1 && !state.cancelled) {
    const next = [];
    for (let i=0;i<players.length;i+=2) {
      if (!players[i+1]) { next.push(players[i]); continue; }
      const a=players[i], b=players[i+1];
      let board=Array(9).fill(null), turn=0, over=false;
      const msg=await channel.send({ embeds:[xoEmbed(a,b,board,turn)], components:xoRows(board,true) });
      while (!over) {
        const result=await waitForBoardMove(channel,msg,board,turn ? b:a);
        if (!result) { over=true; next.push(turn ? b:a); break; }
        board[result.index]=turn ? '⭕':'❌';
        const win=winner(board);
        if (win || board.every(Boolean)) { over=true; if (win) { next.push(turn ? b:a); } else { next.push(random([a,b])); } await msg.edit({embeds:[xoEmbed(a,b,board,turn,win)],components:xoRows(board,false)}).catch(()=>{}); }
        else { turn=1-turn; await msg.edit({embeds:[xoEmbed(a,b,board,turn)],components:xoRows(board,true)}).catch(()=>{}); }
      }
    }
    players=shuffle(next);
  }
  if (players[0]) await finish(state, channel, [players[0]]);
}

function xoRows(board, enabled) {
  const rows=[];
  for(let r=0;r<3;r++) rows.push(new ActionRowBuilder().addComponents(...[0,1,2].map(c=>{
    const i=r*3+c; return new ButtonBuilder().setCustomId(`xo:${i}`).setLabel(board[i]||'·').setStyle(board[i] ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(Boolean(board[i]) || !enabled);
  })));
  return rows;
}
function xoEmbed(a,b,board,turn,win=null){return new EmbedBuilder().setTitle('⭕ XO ❌').setDescription(`${turn?'👤':'👤'} الدور: <@${turn?b:a}>\n\n${board.map((x,i)=>`${x||'▫️'}${(i%3===2?'\n':' ')}`).join('')}${win?'\n\n🏆 انتهت الجولة.':''}`);}
function winner(b){for(const [a,c,d] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) if(b[a]&&b[a]===b[c]&&b[a]===b[d]) return b[a]; return null;}
async function waitForBoardMove(channel,msg,board,userId){return new Promise(resolve=>{const collector=msg.createMessageComponentCollector({time:15000}); collector.on('collect',async i=>{if(i.user.id!==userId)return i.reply({content:'ليس دورك الآن.',ephemeral:true}); const index=Number(i.customId.split(':')[1]); if(board[index])return i.reply({content:'هذه الخانة مشغولة.',ephemeral:true}); await i.deferUpdate(); collector.stop('ok'); resolve({index});}); collector.on('end',c=>{if(c!=='ok')resolve(null);});});}

async function playMafia(channel,state){
  const players=shuffle(state.players), mafiaCount=Math.max(1,Math.floor(players.length/4));
  const roles=new Map(players.map((id,i)=>[id,i<mafiaCount?'مافيا':'مواطن']));
  for(const [id,role] of roles) { const u=await channel.guild.members.fetch(id).catch(()=>null); if(u) u.send(`🎭 دورك في المافيا: **${role}**`).catch(()=>{}); }
  let alive=[...players];
  while(alive.length>1){
    await channel.send({embeds:[new EmbedBuilder().setTitle('🌙 ليلة المافيا').setDescription('أرسل أصحاب دور المافيا قرارهم في الخاص. بعد ذلك تبدأ مرحلة التصويت.') ]});
    await wait(8000);
    const maf=alive.filter(id=>roles.get(id)==='مافيا');
    const target=random(alive.filter(x=>!maf.includes(x))); if(target) alive=alive.filter(x=>x!==target);
    if(alive.length<=1)break;
    await channel.send({embeds:[new EmbedBuilder().setTitle('☀️ نهار جديد').setDescription(`خرج من الجولة: ${target?`<@${target}>`:'لا أحد'}.\n\nصوّتوا الآن باستخدام **/لعب مافيا** في لعبة جديدة عند انتهاء هذه الجولة.`)]});
    const citizenVotes=shuffle(alive.filter(id=>roles.get(id)!=='مافيا'));
    const eliminated=citizenVotes[0]; if(eliminated) alive=alive.filter(x=>x!==eliminated);
    if(alive.filter(id=>roles.get(id)==='مافيا').length >= alive.filter(id=>roles.get(id)!=='مافيا').length) break;
  }
  const mafiaAlive=alive.some(id=>roles.get(id)==='مافيا');
  const winners=alive.filter(id=>roles.get(id)===(mafiaAlive?'مافيا':'مواطن'));
  await finish(state,channel,winners);
}

async function playChairs(channel,state){let players=state.players.slice(); while(players.length>1){const seats=Math.max(1,players.length-1); const msg=await channel.send(`🪑 **الكراسي**\nعدد اللاعبين: ${players.length}\nاضغط الزر للحصول على مقعد!`); const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('chairs:seat').setLabel(`الجلوس (${seats})`).setEmoji('🪑').setStyle(ButtonStyle.Primary)); await msg.edit({content:`🪑 **الكراسي**\nهناك ${seats} مقاعد متاحة. أسرع لاعب يحجز مقعدًا يبقى في الجولة.`,components:[row]}); const taken=new Set(); const c=msg.createMessageComponentCollector({time:10000}); c.on('collect',async i=>{if(taken.has(i.user.id)||!players.includes(i.user.id))return i.reply({content:'لا يمكنك حجز مقعد الآن.',ephemeral:true}); if(taken.size>=seats)return i.reply({content:'امتلأت المقاعد.',ephemeral:true}); taken.add(i.user.id); await i.reply({content:'تم حجز مقعدك! 🪑',ephemeral:true}); if(taken.size>=seats)c.stop('full');}); await new Promise(r=>c.on('end',r)); const eliminated=random(players.filter(x=>!taken.has(x))); players=players.filter(x=>x!==eliminated); if(players.length>1) await channel.send(`💥 خرج <@${eliminated}> من الجولة.`); } await finish(state,channel,[players[0]]);}

async function playRPS(channel,state){let alive=state.players.slice(); const choices=new Map(); const row=new ActionRowBuilder().addComponents(['حجرة','ورقة','مقص'].map((x,i)=>new ButtonBuilder().setCustomId(`rps:${i}`).setLabel(x).setStyle(ButtonStyle.Primary))); const msg=await channel.send({embeds:[new EmbedBuilder().setTitle('✊ حجرة ورقة مقص').setDescription('كل لاعب يختار في الخاص بالقناة. سيتم الاحتفاظ بالاختيار حتى اكتمال الجولة.')],components:[row]}); const c=msg.createMessageComponentCollector({time:15000}); c.on('collect',async i=>{if(!alive.includes(i.user.id))return i.reply({content:'لست ضمن هذه الجولة.',ephemeral:true});choices.set(i.user.id,Number(i.customId.split(':')[1])); await i.reply({content:'تم تسجيل اختيارك.',ephemeral:true});}); await new Promise(r=>c.on('end',r)); while(choices.size<2){choices.set(random(alive),Math.floor(Math.random()*3));} const counts=[0,0,0]; for(const v of choices.values())counts[v]++; let winning=[]; if(counts[0]&&counts[2]&&!counts[1])winning=[0]; else if(counts[1]&&counts[0]&&!counts[2])winning=[1]; else if(counts[2]&&counts[1]&&!counts[0])winning=[2]; else winning=[0,1,2]; const survived=alive.filter(id=>winning.includes(choices.get(id))); if(survived.length===alive.length) {await channel.send('🤝 الجولة انتهت بالتعادل؛ لا أحد خرج.'); return finish(state,channel,alive);} await finish(state,channel,survived.length?survived:[random(alive)]);}

async function playDice(channel,state){const teams=[[],[]]; shuffle(state.players).forEach((id,i)=>teams[i%2].push(id)); const scores=[0,0]; for(let r=1;r<=3;r++){scores[0]+=1+Math.floor(Math.random()*6);scores[1]+=1+Math.floor(Math.random()*6);await channel.send(`🎲 الجولة ${r}: الفريق الأول **${scores[0]}** — الفريق الثاني **${scores[1]}**`);} const win=scores[0]===scores[1]?random([0,1]):scores[0]>scores[1]?0:1; await finish(state,channel,teams[win]);}

async function playHotXO(channel,state){const a=state.players[0],b=state.players[1];let board=Array(9).fill(null), turn=0; const msg=await channel.send({embeds:[xoEmbed(a,b,board,turn)]}); for(let move=0;move<30;move++){const result=await waitForBoardMove(channel,msg,board,turn?a:b);if(!result)break;board[result.index]=turn?'⭕':'❌';if(move>=6)board.findIndex(x=>x=== (turn?'⭕':'❌'))>=0 && (board[move<9?0:Math.floor(Math.random()*9)]=null); if(winner(board)){await finish(state,channel,[turn?b:a]);return;}turn=1-turn;await msg.edit({embeds:[xoEmbed(a,b,board,turn)],components:xoRows(board,true)}).catch(()=>{});}await finish(state,channel,[random([a,b])]);}

async function playHide(channel,state){const seeker=state.players[0];const others=state.players.slice(1);await channel.send(`🙈 **غميضة**\nالباحث: <@${seeker}>\nبقية اللاعبين يختارون أماكنهم ذهنيًا. بعد 10 ثوانٍ سيكشف البوت مكانًا عشوائيًا.`);await wait(10000);const found=shuffle(others).slice(0,Math.max(1,Math.floor(others.length/2)));const winner=random(others.filter(x=>!found.includes(x)))||random(others);await channel.send(`🔎 وجد الباحث: ${mentionList(found)}\n\n🏆 الفائز: <@${winner}>`);await finish(state,channel,[winner]);}

async function playReplica(channel,state){const categories=['حيوان','مدينة','طعام','وظيفة','شيء في المنزل'];const letters='ابتثجحخدذرزسشصضطظعغفقكلمنهوي';const letter=random([...letters]);const cat=random(categories);const msg=await channel.send(`🔁 **ريبلكا**\nالفئة: **${cat}**\nالحرف: **${letter}**\nأول إجابة مقبولة يفوز.`);const c=channel.createMessageCollector({time:15000,filter:m=>state.players.includes(m.author.id)});const winner=await new Promise(resolve=>{c.on('collect',m=>{if(m.content.trim().startsWith(letter))resolve(m.author.id);});c.on('end',()=>resolve(null));});c.stop();await finish(state,channel,winner?[winner]:[random(state.players)]);}

async function playCountry(channel,state){const data=[['🇲🇦','المغرب'],['🇯🇵','اليابان'],['🇧🇷','البرازيل'],['🇫🇷','فرنسا'],['🇪🇬','مصر'],['🇰🇷','كوريا الجنوبية']];const [flag,answer]=random(data);const msg=await channel.send(`🌍 **خمّن الدولة**\nالدولة المخفية: ${flag}\nاكتب اسم الدولة بسرعة!`);const c=channel.createMessageCollector({time:30000,filter:m=>state.players.includes(m.author.id)});let winner=null;c.on('collect',m=>{if(m.content.trim().toLowerCase()===answer.toLowerCase()){winner=m.author.id;c.stop();}});await new Promise(r=>c.on('end',r));await msg.edit(`🌍 **خمّن الدولة**\nالإجابة: **${answer}**\n${winner?`🏆 الفائز: <@${winner}>`:'انتهى الوقت دون إجابة صحيحة.'}`);await finish(state,channel,winner?[winner]:[]);}

async function playDraw(channel,state){const words=['شمس','سيارة','قطة','بيت','هاتف','كرة'];const answer=random(words);const stages=['🟦','🟦🟨','🟦🟨🟥','🟦🟨🟥🟩'];const msg=await channel.send(`✏️ **خمّن الرسمة**\n${stages[0]}\nخمّن ما يُرسم...`);for(const s of stages){await wait(3000);await msg.edit(`✏️ **خمّن الرسمة**\n${s}\nخمّن ما يُرسم...`);}const c=channel.createMessageCollector({time:8000,filter:m=>state.players.includes(m.author.id)});let winner=null;c.on('collect',m=>{if(m.content.trim()===answer){winner=m.author.id;c.stop();}});await new Promise(r=>c.on('end',r));await finish(state,channel,winner?[winner]:[]);}

async function playWord(channel,state){const pool=['مكتبة','حاسوب','بطولة','مغامرة','برمجة','مدرسة','حديقة'];const answer=random(pool);const hint=answer.replace(/./g,(c,i)=>i%2?'ـ':'_');const msg=await channel.send(`🔤 **خمّن الكلمة**\nالتلميح: **${hint}**\nيمكنكم التخمين الآن.`);const c=channel.createMessageCollector({time:20000,filter:m=>state.players.includes(m.author.id)});let winner=null;c.on('collect',m=>{if(m.content.trim()===answer){winner=m.author.id;c.stop();}});await new Promise(r=>c.on('end',r));await msg.edit(`🔤 **خمّن الكلمة**\nالكلمة: **${answer}**\n${winner?`🏆 <@${winner}>`:'انتهى الوقت.'}`);await finish(state,channel,winner?[winner]:[]);}

export async function handleButton(interaction){
  const [kind,a,b] = interaction.customId.split(':');
  if(kind==='game'){
    const state=activeGames.get(interaction.channelId); if(!state||state.id!==a)return interaction.reply({content:'انتهت هذه اللعبة.',ephemeral:true});
    if(b==='join'){if(state.players.includes(interaction.user.id))return interaction.reply({content:'أنت منضم بالفعل.',ephemeral:true});if(state.started)return interaction.reply({content:'بدأت اللعبة بالفعل.',ephemeral:true});if(state.players.length>=20)return interaction.reply({content:'وصل اللوبي إلى الحد الأقصى.',ephemeral:true});state.players.push(interaction.user.id);await interaction.update({embeds:[lobbyEmbed(state.id,state.players)],components:[joinRow(state.id)]});}
    else if(b==='start'){if(state.players.length<2)return interaction.reply({content:'تحتاج اللعبة إلى لاعبين اثنين على الأقل.',ephemeral:true});if(state.started)return interaction.reply({content:'بدأت اللعبة بالفعل.',ephemeral:true});state.started=true;clearTimeout(timers.get(state.channelId));timers.delete(state.channelId);await interaction.update({embeds:[lobbyEmbed(state.id,state.players)],components:[joinRow(state.id,true)]});await launchServerGame(interaction.channel,state);}
    else {state.cancelled=true;activeGames.delete(interaction.channelId);clearTimeout(timers.get(interaction.channelId));timers.delete(interaction.channelId);await interaction.update({content:'تم إلغاء اللعبة.',embeds:[],components:[]});}
    return;
  }
  if(kind==='xo'||kind==='rps'||kind==='chairs') return interaction.deferUpdate();
}

export async function handleModal(){ /* reserved for future text-input games */ }

async function startMini(interaction,id){
  const guildId=interaction.guildId; const userId=interaction.user.id; let payload;
  if(id==='button'){payload={content:'👆 **زر**\nكن أول من يضغط عندما يظهر الزر.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mini:button`).setLabel('انتظر...').setStyle(ButtonStyle.Secondary))]};}
  else if(id==='fast'){const word=random(['سرعة','برق','فوز','أسرع']);payload={content:`⚡ **أسرع**\nأول من يكتب: **${word}** يفوز.`};payload._answer=word;}
  else if(id==='split'){const word=random(['مغامرة','بطولة','برمجة']);payload={content:`✂️ **فكك**\nأعد الكلمة متصلة: **${[...word].join(' - ')}**`};payload._answer=word;}
  else if(id==='merge'){const word=random(['سيارة','مكتبة','هاتف']);payload={content:`🔗 **ادمج**\nادمج الأحرف: **${shuffle([...word]).join(' ')}**`};payload._answer=word;}
  else if(id==='flag'){const data=random([['🇲🇦','المغرب'],['🇯🇵','اليابان'],['🇫🇷','فرنسا'],['🇧🇷','البرازيل']]);payload={content:`🚩 **أعلام**\nما الدولة التي يرمز إليها العلم ${data[0]}؟`};payload._answer=data[1];}
  else if(id==='reverse'){const word=random(['Discord','Games','Fizbo']);payload={content:`🔁 **اعكس**\nاعكس: **${word}**`};payload._answer=[...word].reverse().join('');}
  else if(id==='letter'){const word=random(['مدرسة','حاسوب','مدينة']);const i=Math.floor(Math.random()*word.length);payload={content:`🔠 **حرف**\nما الحرف المفقود؟ **${word.slice(0,i)}_${word.slice(i+1)}**`};payload._answer=word[i];}
  else if(id==='correct'){payload={content:'✏️ **صحح**\nالكلمة: **مكتبه**\nاكتبها بالشكل الصحيح.'};payload._answer='مكتبة';}
  else if(id==='sort'){const nums=shuffle([1,2,3,4,5]);payload={content:`🔢 **ترتيب**\nرتب الأرقام تصاعديًا: **${nums.join('  ')}`};payload._answer='1 2 3 4 5';}
  else if(id==='colors'){const x=random(['أحمر','أزرق','أخضر','أصفر']);payload={content:`🎨 **ألوان**\nاكتب اسم اللون: **${x}**`};payload._answer=x;}
  else if(id==='emoji'){const x=random(['😀','🔥','🌹','🎯','🐱']);payload={content:`😀 **إيموجي**\nأرسل هذا الإيموجي بالضبط: ${x}`};payload._answer=x;}
  else {const word=random(['قمر','كتاب','لعبة','بحر']);payload={content:`🃏 **اكشف**\nالكلمة: **${word[0]} _ _ _**`};payload._answer=word;}
  await interaction.reply(payload);
  if(payload._answer){const msg=await interaction.fetchReply(); const collector=interaction.channel.createMessageCollector({time:12000,filter:m=>m.author.id!==interaction.client.user.id});let winner=null;collector.on('collect',m=>{if(m.content.trim().toLowerCase()===String(payload._answer).toLowerCase()){winner=m.author.id;collector.stop();}});await new Promise(r=>collector.on('end',r));await interaction.channel.send(winner?`🏆 <@${winner}> فاز في **${names[id]}**!`:`⏱️ انتهى الوقت في **${names[id]}**.`);recordGame(guildId,userId,winner===userId,winner===userId?3:0);}
}

export function bindGuilds(client){global.clientGuilds=client.guilds.cache;}
