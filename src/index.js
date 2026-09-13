import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { handleGameCommand, handleButton, handleModal, activeGames } from './games-safe.js';
import { initDatabase } from './store.js';

const token=process.env.DISCORD_TOKEN, clientId=process.env.CLIENT_ID, guildId=process.env.GUILD_ID||null;
if(!token||!clientId) throw new Error('يرجى ضبط DISCORD_TOKEN و CLIENT_ID في ملف البيئة.');
await initDatabase();
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent],partials:[Partials.GuildMember,Partials.Channel]});
const choices=[['xo','XO'],['mafia','مافيا'],['chairs','كراسي'],['rps','حجرة ورقة مقص'],['dice','نرد'],['hotxo','HotXO'],['hide','غميضة'],['replica','ريبلكا'],['country','خمّن الدولة'],['draw','خمّن الرسمة'],['word','خمّن الكلمة'],['button','زر'],['fast','أسرع'],['split','فكك'],['merge','ادمج'],['flag','أعلام'],['reverse','اعكس'],['letter','حرف'],['correct','صحح'],['sort','ترتيب'],['colors','ألوان'],['emoji','إيموجي'],['reveal','اكشف']];
const play=new SlashCommandBuilder().setName('لعب').setDescription('ابدأ إحدى ألعاب البوت').addStringOption(o=>{o.setName('اللعبة').setDescription('اختر اللعبة').setRequired(true);for(const [v,n] of choices)o.addChoices({name:n,value:v});return o;});
const stop=new SlashCommandBuilder().setName('إيقاف-اللعبة').setDescription('إيقاف اللعبة الحالية في القناة').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);
const rest=new REST({version:'10'}).setToken(token);await rest.put(guildId?Routes.applicationGuildCommands(clientId,guildId):Routes.applicationCommands(clientId),{body:[play,stop].map(x=>x.toJSON())});
client.once('ready',()=>{console.log(`✅ تم تسجيل الدخول باسم ${client.user.tag}`);client.user.setActivity('ألعاب ديسكورد | /لعب');});
client.on('interactionCreate',async i=>{try{if(i.isChatInputCommand()){if(i.commandName==='لعب')await handleGameCommand(i,i.options.getString('اللعبة',true));else if(i.commandName==='إيقاف-اللعبة'){const g=activeGames.get(i.channelId);if(!g)return i.reply({content:'لا توجد لعبة نشطة في هذه القناة.',ephemeral:true});g.cancelled=true;activeGames.delete(i.channelId);await i.reply('تم إيقاف اللعبة الحالية بنجاح.');}return;}if(i.isButton())await handleButton(i);if(i.isModalSubmit())await handleModal(i);}catch(e){console.error(e);const p={content:'حدث خطأ غير متوقع أثناء تشغيل اللعبة. يرجى المحاولة مرة أخرى.',ephemeral:true};if(i.replied||i.deferred)await i.followUp(p).catch(()=>{});else await i.reply(p).catch(()=>{});}});
client.on('guildMemberUpdate',async(oldM,newM)=>{if(oldM.premiumSince||!newM.premiumSince)return;const id=process.env.POST_CHANNEL_ID;if(!id)return;const ch=await newM.guild.channels.fetch(id).catch(()=>null);if(ch?.isTextBased())await ch.send(`**${newM} احلا من يحط البوست🌹**`).catch(()=>{});});
process.on('unhandledRejection',console.error);process.on('uncaughtException',console.error);
await client.login(token);
