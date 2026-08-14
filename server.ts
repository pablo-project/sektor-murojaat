import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import TelegramBot from 'node-telegram-bot-api';
import { INITIAL_ORGANIZATIONS, INITIAL_APPEALS } from './src/data/initialData.js';
import { Appeal, Organization, FeedbackStatus, BotStatusInfo } from './src/types.js';

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

const app = express();
app.use(express.json({ limit: '10mb' }));

const STORAGE_FILE = path.join(process.cwd(), 'data-storage.json');

let organizations: Organization[] = [...INITIAL_ORGANIZATIONS];
let appeals: Appeal[] = [...INITIAL_APPEALS];
let savedTelegramToken: string | null = null;

function loadPersistedData() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.appeals && Array.isArray(parsed.appeals)) {
        appeals = parsed.appeals;
      }
      if (parsed.organizations && Array.isArray(parsed.organizations)) {
        const existingIds = new Set(parsed.organizations.map((o: any) => o.id));
        organizations = [
          ...parsed.organizations,
          ...INITIAL_ORGANIZATIONS.filter((o) => !existingIds.has(o.id)),
        ];
      }
      if (parsed.savedTelegramToken) {
        savedTelegramToken = parsed.savedTelegramToken;
      }
    }
  } catch (err) {
    console.error('Failed to load persisted data:', err);
  }
}

function savePersistedData() {
  try {
    fs.writeFileSync(
      STORAGE_FILE,
      JSON.stringify({ appeals, organizations, savedTelegramToken }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to save persisted data:', err);
  }
}

loadPersistedData();

function recalculateOrgStats() {
  organizations = organizations.map((org) => {
    const orgAppeals = appeals.filter((a) => a.organizationId === org.id);
    return {
      ...org,
      totalAppeals: orgAppeals.length,
      resolvedAppeals: orgAppeals.filter((a) => a.status === 'hal_etildi').length,
      inProgressAppeals: orgAppeals.filter((a) => a.status === 'jarayonda' || a.status === 'yangi').length,
      objectionAppeals: orgAppeals.filter((a) => a.feedback === 'etirozli').length,
      rejectedAuthorityAppeals: orgAppeals.filter((a) => a.status === 'vakolatda_emas').length,
    };
  });
  savePersistedData();
}

recalculateOrgStats();

let telegramToken: string | null = process.env.TELEGRAM_BOT_TOKEN || savedTelegramToken || null;
let telegramBot: TelegramBot | null = null;
let botInfo: BotStatusInfo = { isActive: false };

function sanitizeBotToken(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
  if (cleaned.length < 15 || !cleaned.includes(':')) return null;
  return cleaned;
}

interface UserTelegramSession {
  step: 'NONE' | 'SELECT_ORG' | 'WAITING_FULLNAME' | 'WAITING_PHONE' | 'WAITING_ADDRESS' | 'WAITING_CONTENT' | 'WAITING_OBJECTION';
  orgId?: string;
  orgName?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  appealIdForObjection?: string;
}

const userSessions = new Map<number, UserTelegramSession>();

async function initOrRestartTelegramBot(rawToken?: string | null) {
  const validToken = sanitizeBotToken(rawToken);
  if (!validToken) {
    console.log('⚠️ Yaroqli Telegram Bot Token mavjud emas.');
    return;
  }

  if (telegramBot) {
    try {
      await telegramBot.stopPolling();
    } catch (e) {
      // ignore
    }
    telegramBot = null;
  }

  try {
    telegramToken = validToken;
    savedTelegramToken = validToken;
    savePersistedData();

    telegramBot = new TelegramBot(validToken, { polling: true });
    const me = await telegramBot.getMe();
    botInfo = {
      isActive: true,
      botUsername: me.username,
      botFirstName: me.first_name,
    };
    console.log(`🤖 Telegram Bot faollashtirildi: @${me.username}`);

    telegramBot.on('polling_error', (error) => {
      console.error('Telegram Polling xatosi:', error.message);
    });

    // /start buyrug'i
    telegramBot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      userSessions.set(chatId, { step: 'NONE' });

      const welcomeText =
        `Assalomu alaykum, <b>${msg.from?.first_name || 'Hurmatli fuqaro'}</b>!\n\n` +
        `🏛 <b>Murojaatlar va Tashkilotlar Nazorati</b> rasmiy Telegram botiga xush kelibsiz.\n\n` +
        `Ushbu bot orqali siz tuman/shahar tashkilotlariga to‘g‘ridan-to‘g‘ri murojaat yuborishingiz, ijro jarayonini kuzatishingiz va bajarilgan ishlarga baho berishingiz mumkin.`;

      telegramBot?.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '📝 Yangi murojaat yuborish' }],
            [{ text: '📋 Mening murojaatlarim holati' }],
            [{ text: '🏢 Tashkilotlar ro\'yxati' }, { text: 'ℹ️ Yordam' }],
          ],
          resize_keyboard: true,
        },
      });
    });

    // Yangi murojaat yuborish
    telegramBot.onText(/📝 Yangi murojaat yuborish/, (msg) => {
      const chatId = msg.chat.id;
      userSessions.set(chatId, { step: 'SELECT_ORG' });

      const buttons = organizations.map((org) => [
        {
          text: org.name,
          callback_data: `org_${org.id}`,
        },
      ]);

      telegramBot?.sendMessage(
        chatId,
        `Qaysi tashkilotga murojaat yo‘llamoqchisiz? Ro‘yxatdan tanlang:`,
        {
          reply_markup: {
            inline_keyboard: buttons,
          },
        }
      );
    });

    // Mening murojaatlarim
    telegramBot.onText(/📋 Mening murojaatlarim holati/, (msg) => {
      const chatId = msg.chat.id;
      const userAppeals = appeals.filter((a) => a.telegramChatId === chatId);

      if (userAppeals.length === 0) {
        telegramBot?.sendMessage(
          chatId,
          `Siz hali murojaat yubormagansiz. "📝 Yangi murojaat yuborish" tugmasi orqali ariza qoldirishingiz mumkin.`
        );
        return;
      }

      let text = `📋 <b>Sizning murojaatlaringiz ro‘yxati (${userAppeals.length} ta):</b>\n\n`;
      userAppeals.forEach((a, index) => {
        let statusEmoji = '⏳ Jarayonda';
        if (a.status === 'hal_etildi') statusEmoji = '✅ Hal etildi';
        if (a.status === 'yangi') statusEmoji = '🆕 Yangi';
        if (a.status === 'vakolatda_emas') statusEmoji = '⚠️ Boshqa tashkilotga yo\'naltirilgan';

        text += `${index + 1}. <b>№ ${a.appealNumber}</b>\n`;
        text += `🏢 Tashkilot: ${a.organizationName}\n`;
        text += `📌 Holati: ${statusEmoji}\n`;
        if (a.resolutionText) {
          text += `💬 Tashkilot javobi: <i>${a.resolutionText}</i>\n`;
        }
        text += `📅 Sana: ${new Date(a.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
      });

      telegramBot?.sendMessage(chatId, text, { parse_mode: 'HTML' });
    });

    // Tashkilotlar ro'yxati
    telegramBot.onText(/🏢 Tashkilotlar ro'yxati/, (msg) => {
      const chatId = msg.chat.id;
      let text = `🏢 <b>Tizimga ulangan tashkilotlar:</b>\n\n`;
      organizations.forEach((o, i) => {
        text += `${i + 1}. <b>${o.name}</b>\n📞 Tel: ${o.phone}\n👤 Rahbar: ${o.leader}\n\n`;
      });
      telegramBot?.sendMessage(chatId, text, { parse_mode: 'HTML' });
    });

    // Yordam
    telegramBot.onText(/ℹ️ Yordam/, (msg) => {
      const chatId = msg.chat.id;
      telegramBot?.sendMessage(
        chatId,
        `ℹ️ <b>Yordam bo‘limi</b>\n\n` +
          `1. "Yangi murojaat yuborish" tugmasini bosing.\n` +
          `2. Kerakli tashkilotni tanlang.\n` +
          `3. Ism-familiyangiz va telefoningizni yuboring.\n` +
          `4. Yashash manzilingiz va murojaat matnini yuboring.\n` +
          `5. Murojaat hal etilgach sizga xabar va fotosurat yuboriladi.`,
        { parse_mode: 'HTML' }
      );
    });

    // Callback tugmalar
    telegramBot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      if (!chatId || !query.data) return;

      const session = userSessions.get(chatId) || { step: 'NONE' };

      if (query.data.startsWith('org_')) {
        const orgId = query.data.replace('org_', '');
        const org = organizations.find((o) => o.id === orgId);
        if (org) {
          session.step = 'WAITING_FULLNAME';
          session.orgId = org.id;
          session.orgName = org.name;
          userSessions.set(chatId, session);

          await telegramBot?.answerCallbackQuery(query.id);
          await telegramBot?.sendMessage(
            chatId,
            `🏢 Tanlangan tashkilot: <b>${org.name}</b>\n\n` +
              `Iltimos, to‘liq <b>Familiyangiz, Ismingiz va Otangizning ismini</b> kiriting:`,
            { parse_mode: 'HTML' }
          );
        }
      }

      if (query.data.startsWith('feedback_agree_')) {
        const appealId = query.data.replace('feedback_agree_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) {
          appeal.feedback = 'roziman';
          recalculateOrgStats();
          await telegramBot?.answerCallbackQuery(query.id, { text: 'Rahmat! Fikringiz qabul qilindi.' });
          await telegramBot?.sendMessage(
            chatId,
            `✅ Sizning javobingiz qabul qilindi: <b>Roziman (Ijobiy)</b>.\nBaholaganingiz uchun tashakkur!`,
            { parse_mode: 'HTML' }
          );
        }
      }

      if (query.data.startsWith('feedback_object_')) {
        const appealId = query.data.replace('feedback_object_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) {
          session.step = 'WAITING_OBJECTION';
          session.appealIdForObjection = appeal.id;
          userSessions.set(chatId, session);

          await telegramBot?.answerCallbackQuery(query.id);
          await telegramBot?.sendMessage(
            chatId,
            `🔴 Iltimos, nima sababdan rozi emasligingizni (e'tirozingiz sababini) yozib yuboring:`,
            { parse_mode: 'HTML' }
          );
        }
      }
    });

    // Xabarlarni qabul qilish
    telegramBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();
      const session = userSessions.get(chatId);

      if (!session || session.step === 'NONE' || text?.startsWith('/')) return;
      if (text === '📝 Yangi murojaat yuborish' || text === '📋 Mening murojaatlarim holati' || text === '🏢 Tashkilotlar ro\'yxati' || text === 'ℹ️ Yordam') return;

      if (session.step === 'WAITING_FULLNAME' && text) {
        session.fullName = text;
        session.step = 'WAITING_PHONE';
        userSessions.set(chatId, session);

        await telegramBot?.sendMessage(
          chatId,
          `Rahmat, <b>${text}</b>!\n\nBog‘lanish uchun telefon raqamingizni yuboring (masalan: +998901234567) yoki quyidagi tugmani bosing:`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '📱 Raqamimni yuborish', request_contact: true }],
                [{ text: '❌ Bekor qilish' }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
        return;
      }

      if (session.step === 'WAITING_PHONE') {
        let phoneStr = msg.contact?.phone_number || text;
        if (text === '❌ Bekor qilish') {
          userSessions.set(chatId, { step: 'NONE' });
          await telegramBot?.sendMessage(chatId, 'Murojaat bekor qilindi.');
          return;
        }

        if (phoneStr) {
          if (!phoneStr.startsWith('+')) phoneStr = `+${phoneStr}`;
          session.phone = phoneStr;
          session.step = 'WAITING_ADDRESS';
          userSessions.set(chatId, session);

          await telegramBot?.sendMessage(
            chatId,
            `Yashash <b>manzilingizni</b> kiriting (masalan: Bog'ot MFY, Mustaqillik ko'chasi 12-uy):`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                keyboard: [[{ text: '❌ Bekor qilish' }]],
                resize_keyboard: true,
              },
            }
          );
        }
        return;
      }

      if (session.step === 'WAITING_ADDRESS' && text) {
        if (text === '❌ Bekor qilish') {
          userSessions.set(chatId, { step: 'NONE' });
          await telegramBot?.sendMessage(chatId, 'Murojaat bekor qilindi.');
          return;
        }

        session.address = text;
        session.step = 'WAITING_CONTENT';
        userSessions.set(chatId, session);

        await telegramBot?.sendMessage(
          chatId,
          `Endi murojaatingizning <b>batafsil mazmunini</b> yozing (agar kerak bo‘lsa fotosurat bilan birga yuboring):`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [[{ text: '❌ Bekor qilish' }]],
              resize_keyboard: true,
            },
          }
        );
        return;
      }

      if (session.step === 'WAITING_CONTENT') {
        if (text === '❌ Bekor qilish') {
          userSessions.set(chatId, { step: 'NONE' });
          await telegramBot?.sendMessage(chatId, 'Murojaat bekor qilindi.');
          return;
        }

        const appealContent = text || msg.caption || '(Faqat fotosurat ilova qilindi)';
        let photoLink: string | undefined = undefined;

        if (msg.photo && msg.photo.length > 0) {
          const highestResPhoto = msg.photo[msg.photo.length - 1];
          try {
            photoLink = await telegramBot?.getFileLink(highestResPhoto.file_id);
          } catch (err) {
            console.error('Photo link olishda xato:', err);
          }
        }

        const newId = `app-${Date.now()}`;
        const appealNum = `MUR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

        const newAppeal: Appeal = {
          id: newId,
          appealNumber: appealNum,
          organizationId: session.orgId || 'org-1',
          organizationName: session.orgName || 'Tashkilot',
          fullName: session.fullName || 'Fuqaro',
          phone: session.phone || '+998 90 000-00-00',
          address: session.address || '',
          content: appealContent,
          attachmentUrl: photoLink,
          category: organizations.find((o) => o.id === session.orgId)?.category || 'Umumiy',
          createdAt: new Date().toISOString(),
          status: 'yangi',
          feedback: 'kutilmoqda',
          telegramChatId: chatId,
        };

        appeals.unshift(newAppeal);
        recalculateOrgStats();
        userSessions.set(chatId, { step: 'NONE' });

        await telegramBot?.sendMessage(
          chatId,
          `✅ <b>Murojaatingiz qabul qilindi!</b>\n\n` +
            `📄 <b>Raqami:</b> <code>${appealNum}</code>\n` +
            `🏢 <b>Mas'ul tashkilot:</b> ${session.orgName}\n` +
            `⏱️ <b>Muddati:</b> 24 soat\n\n` +
            `Murojaat ijrosi bo‘yicha natija va fotosurat ushbu bot orqali sizga yuboriladi.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '📝 Yangi murojaat yuborish' }],
                [{ text: '📋 Mening murojaatlarim holati' }],
                [{ text: '🏢 Tashkilotlar ro\'yxati' }, { text: 'ℹ️ Yordam' }],
              ],
              resize_keyboard: true,
            },
          }
        );
        return;
      }

      if (session.step === 'WAITING_OBJECTION' && text && session.appealIdForObjection) {
        const appeal = appeals.find((a) => a.id === session.appealIdForObjection);
        if (appeal) {
          appeal.feedback = 'etirozli';
          appeal.objectionText = text;
          appeal.objectionAt = new Date().toISOString();
          appeal.status = 'jarayonda';
          recalculateOrgStats();

          await telegramBot?.sendMessage(
            chatId,
            `⚠️ E'tirozingiz qabul qilindi! Murojaat Bosh Kabinet va tashkilotga qayta ijro uchun yuborildi.`
          );
        }
        userSessions.set(chatId, { step: 'NONE' });
      }
    });
  } catch (err: any) {
    console.error('Telegram Botni boshlashda xatolik:', err.message);
    throw err;
  }
}

initOrRestartTelegramBot(telegramToken);

async function notifyTelegramUserResolved(appeal: Appeal) {
  if (!telegramBot || !appeal.telegramChatId) return;

  const text =
    `🎉 <b>Murojaatingiz ko‘rib chiqildi va hal etildi!</b>\n\n` +
    `📄 <b>Murojaat №:</b> <code>${appeal.appealNumber}</code>\n` +
    `🏢 <b>Tashkilot:</b> ${appeal.organizationName}\n` +
    `💬 <b>Bajarilgan ish / Xulosa:</b>\n<i>${appeal.resolutionText}</i>\n\n` +
    `Iltimos, tashkilot tomonidan bajarilgan ish sifatini baholang:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '👍 Roziman (Ijobiy)', callback_data: `feedback_agree_${appeal.id}` },
        { text: '👎 E\'tirozim bor', callback_data: `feedback_object_${appeal.id}` },
      ],
    ],
  };

  try {
    if (appeal.resolutionPhotoUrl) {
      await telegramBot.sendPhoto(appeal.telegramChatId, appeal.resolutionPhotoUrl, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      });
    } else {
      await telegramBot.sendMessage(appeal.telegramChatId, text, {
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      });
    }
  } catch (err: any) {
    console.error('Telegram notification yuborishda xato:', err.message);
  }
}

// REST API Endpoints

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Parol kiritilmadi' });
  }

  if (password === 'admin123' || password === 'admin2026' || password === 'pablo2026') {
    return res.json({ success: true, role: 'bosh_kabinet' });
  }

  const org = organizations.find((o) => o.password === password);
  if (org) {
    return res.json({ success: true, role: 'tashkilot', organization: org });
  }

  return res.status(401).json({ success: false, message: 'Kiritilgan maxsus parol noto‘g‘ri!' });
});

app.post('/api/telegram/configure', async (req, res) => {
  const { token } = req.body;
  const valid = sanitizeBotToken(token);
  if (!valid) {
    return res.status(400).json({ success: false, error: 'Yaroqsiz Telegram bot token kiritildi' });
  }
  try {
    await initOrRestartTelegramBot(valid);
    if (botInfo.isActive) {
      return res.json({ success: true, bot: botInfo });
    } else {
      return res.status(400).json({ success: false, error: 'Telegram botga ulanib bo‘lmadi. Tokenni tekshiring.' });
    }
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Botni ulashda xatolik' });
  }
});

app.get('/api/organizations', (req, res) => {
  recalculateOrgStats();
  res.json(organizations);
});

app.post('/api/organizations', (req, res) => {
  const { name, code, category, phone, leader, password } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Tashkilot nomi va kodi kiritilishi shart' });
  }

  const newOrg: Organization = {
    id: `org-${Date.now()}`,
    name,
    code,
    category: category || 'Davlat Tashkiloti',
    phone: phone || '+998 71 200-00-00',
    leader: leader || 'Mas\'ul Xodim',
    password: password || `${code.toLowerCase().replace(/[^a-z0-9]/g, '')}123`,
    totalAppeals: 0,
    resolvedAppeals: 0,
    inProgressAppeals: 0,
    objectionAppeals: 0,
    rejectedAuthorityAppeals: 0,
  };

  organizations.push(newOrg);
  recalculateOrgStats();
  res.status(201).json(newOrg);
});

app.get('/api/appeals', (req, res) => {
  const { organizationId, status, feedback, search } = req.query;
  let filtered = [...appeals];

  if (organizationId) {
    filtered = filtered.filter((a) => a.organizationId === organizationId);
  }
  if (status) {
    filtered = filtered.filter((a) => a.status === status);
  }
  if (feedback) {
    filtered = filtered.filter((a) => a.feedback === feedback);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.appealNumber.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.content.toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(filtered);
});

app.patch('/api/appeals/:id/accept', (req, res) => {
  const { id } = req.params;
  const { operatorName } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.status = 'jarayonda';
  appeal.assignedOperator = operatorName || 'Mas\'ul mutaxassis';
  appeal.startedAt = new Date().toISOString();

  recalculateOrgStats();
  res.json(appeal);
});

app.patch('/api/appeals/:id/reject-authority', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.status = 'vakolatda_emas';
  appeal.resolutionText = reason || 'Ushbu murojaat tashkilot vakolatiga kirmaydi va Bosh Kabinetga yo\'naltirildi.';
  
  recalculateOrgStats();
  res.json(appeal);
});

app.patch('/api/appeals/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolutionText, resolutionPhotoUrl } = req.body;

  if (!resolutionText) {
    return res.status(400).json({ error: 'Hulosa matni kiritilishi shart' });
  }

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.status = 'hal_etildi';
  appeal.resolutionText = resolutionText;
  appeal.resolutionPhotoUrl = resolutionPhotoUrl || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80';
  appeal.resolvedAt = new Date().toISOString();
  appeal.feedback = 'kutilmoqda';

  recalculateOrgStats();
  await notifyTelegramUserResolved(appeal);

  res.json(appeal);
});

app.patch('/api/appeals/:id/feedback', (req, res) => {
  const { id } = req.params;
  const { feedback, objectionText } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.feedback = feedback as FeedbackStatus;
  if (feedback === 'etirozli') {
    appeal.objectionText = objectionText || 'Foydalanuvchi hal etilgan natijadan qoniqmadi.';
    appeal.objectionAt = new Date().toISOString();
  }

  recalculateOrgStats();
  res.json(appeal);
});

app.post('/api/gemini/suggest-response', async (req, res) => {
  const { appealContent, organizationName } = req.body;

  if (!aiClient) {
    return res.json({
      suggestedResponse: `Hurmatli fuqaro, sizning "${organizationName}"ga yo'llagan murojaatingiz mutaxassislar tomonidan atroflicha ko'rib chiqildi hamda belgilangan tartibda ijobiy hal etildi.`,
    });
  }

  try {
    const prompt = `Siz Uzbekistan davlat tashkilotining rasmiy mas'ul xodimisiz. 
Foydalanuvchi murojaati: "${appealContent}"
Tashkilot nomi: "${organizationName}"

Ushbu murojaat hal etilganligi bo'yicha rasmiy, xushmuomala, aniq va londa hulosa javob matnini o'zbek tilida tayyorlab bering (max 3-4 cümladan oshmasin).`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const text = response.text || 'Murojaatingiz belgilangan tartibda o\'rganib chiqildi va hal etildi.';
    res.json({ suggestedResponse: text });
  } catch (err) {
    console.error('Gemini error:', err);
    res.json({
      suggestedResponse: `Hurmatli fuqaro, sizning "${organizationName}"ga yo'llagan murojaatingiz mutaxassislar tomonidan atroflicha ko'rib chiqildi hamda belgilangan tartibda ijobiy hal etildi.`,
    });
  }
});

app.get('/api/telegram/status', (req, res) => {
  res.json(botInfo);
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint topilmadi: ${req.method} ${req.path}` });
});

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});