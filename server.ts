import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import TelegramBot from 'node-telegram-bot-api';
import { INITIAL_ORGANIZATIONS, INITIAL_APPEALS } from './src/data/initialData.js';
import { Appeal, Organization, AppealStatus, FeedbackStatus, BotStatusInfo } from './src/types.js';


const __dirname = process.cwd();

// Initialize Gemini Client safely
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const app = express();

app.use(cors({
  origin: true,
  credentials: false,
}));

app.use(express.json({ limit: '10mb' }));
// In-Memory Data Store
let organizations: Organization[] = [...INITIAL_ORGANIZATIONS];
let appeals: Appeal[] = [...INITIAL_APPEALS];

// Helper to recalculate organization statistics
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
}

// Recalculate initial stats
recalculateOrgStats();

// Telegram Bot Initialization
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
let telegramBot: TelegramBot | null = null;
let botInfo: BotStatusInfo = { isActive: false };

interface UserTelegramSession {
  step: 'NONE' | 'SELECT_ORG' | 'WAITING_FULLNAME' | 'WAITING_PHONE' | 'WAITING_ADDRESS' | 'WAITING_CONTENT' | 'WAITING_OBJECTION';
  orgId?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  objectionAppealId?: string;
}

const userSessions: Record<number, UserTelegramSession> = {};

if (telegramToken && telegramToken.trim().length > 10) {
  try {
    telegramBot = new TelegramBot(telegramToken.trim(), { polling: true });

    telegramBot.getMe().then((me) => {
      botInfo = {
        isActive: true,
        botUsername: me.username,
        botFirstName: me.first_name,
      };
      console.log(`🤖 Telegram Bot Active: @${me.username}`);
    }).catch((err) => {
      console.error('Telegram Bot Authentication Error:', err.message);
      botInfo = { isActive: false };
    });

    // Helper for sending Telegram keyboards
    const sendOrgSelection = (chatId: number) => {
      const inlineKeyboard = organizations.map((org) => [
        {
          text: `🏢 ${org.name}`,
          callback_data: `org_${org.id}`,
        },
      ]);

      telegramBot?.sendMessage(
        chatId,
        '<b>Assalomu alaykum!</b>\n\nMurojaat yo\'llamoqchi bo\'lgan <b>davlat tashkilotini</b> tanlang:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }
      );
    };

    // Bot Commands
    telegramBot.onText(/\/start|\/murojaat/, (msg) => {
      const chatId = msg.chat.id;
      userSessions[chatId] = { step: 'SELECT_ORG' };
      sendOrgSelection(chatId);
    });

    telegramBot.onText(/\/my_appeals|\/murojaatlarim/, (msg) => {
      const chatId = msg.chat.id;
      const myAppeals = appeals.filter((a) => a.telegramChatId === chatId);

      if (myAppeals.length === 0) {
        telegramBot?.sendMessage(
          chatId,
          'Sizda hali yuborilgan murojaatlar mavjud emas. Yangi murojaat yo\'llash uchun /start ni bosing.'
        );
        return;
      }

      let text = '<b>📋 Sizning Murojaatlaringiz Ro\'yxati:</b>\n\n';
      myAppeals.forEach((a, i) => {
        const statusEmoji =
          a.status === 'hal_etildi'
            ? '✅ Hal etildi'
            : a.status === 'jarayonda'
            ? '⏳ Jarayonda'
            : a.status === 'vakolatda_emas'
            ? '❌ Vakolatda emas'
            : '🆕 Yangi';

        text += `<b>${i + 1}. № ${a.appealNumber}</b>\n🏢 Tashkilot: ${a.organizationName}\nStatus: ${statusEmoji}\n`;
        if (a.resolutionText) {
          text += `📝 Xulosa: ${a.resolutionText}\n`;
        }
        text += '-------------------------------\n';
      });

      telegramBot?.sendMessage(chatId, text, { parse_mode: 'HTML' });
    });

    // Handle Inline Button Callback Queries
    telegramBot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (!chatId || !data) return;

      // Organization selection
      if (data.startsWith('org_')) {
        const orgId = data.replace('org_', '');
        const org = organizations.find((o) => o.id === orgId);

        if (!org) {
          telegramBot?.answerCallbackQuery(query.id, { text: 'Tashkilot topilmadi' });
          return;
        }

        userSessions[chatId] = {
          step: 'WAITING_FULLNAME',
          orgId: org.id,
        };

        telegramBot?.answerCallbackQuery(query.id, { text: `Tanlandi: ${org.name}` });
        telegramBot?.sendMessage(
          chatId,
          `Siz 🏢 <b>${org.name}</b>ni tanladingiz.\n\nIltimos, <b>Ism va Familiyangizni</b> kiriting:`,
          { parse_mode: 'HTML' }
        );
      }

      // Feedback buttons
      if (data.startsWith('fb_roziman_')) {
        const appealId = data.replace('fb_roziman_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) {
          appeal.feedback = 'roziman';
          recalculateOrgStats();
          telegramBot?.answerCallbackQuery(query.id, { text: 'Rahmat! Bahaingiz saqlandi.' });
          telegramBot?.sendMessage(
            chatId,
            '🟢 <b>Rahmat!</b> Siz "ROZIMAN" tugmasini bosdingiz. Murojaat ijobiy yopildi.',
            { parse_mode: 'HTML' }
          );
        }
      }

      if (data.startsWith('fb_etiroz_')) {
        const appealId = data.replace('fb_etiroz_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) {
          userSessions[chatId] = {
            step: 'WAITING_OBJECTION',
            objectionAppealId: appealId,
          };
          telegramBot?.answerCallbackQuery(query.id, { text: 'E\'tirozizni kiriting' });
          telegramBot?.sendMessage(
            chatId,
            '🔴 <b>E\'tirozingiz sababini yozib yuboring:</b>\nUshbu e\'tiroz va murojaat bosh nazorat markaziga yuboriladi.',
            { parse_mode: 'HTML' }
          );
        }
      }
    });

    // Handle Text Messages
    telegramBot.on('message', (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();

      if (!text || text.startsWith('/')) return;

      const session = userSessions[chatId] || { step: 'NONE' };

      if (session.step === 'WAITING_FULLNAME') {
        session.fullName = text;
        session.step = 'WAITING_PHONE';
        telegramBot?.sendMessage(
          chatId,
          `Rahmat, <b>${text}</b>.\n\nEndi bog'lanish uchun <b>Telefon raqamingizni</b> kiriting (masalan: +998 90 123 45 67):`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (session.step === 'WAITING_PHONE') {
        session.phone = text;
        session.step = 'WAITING_ADDRESS';
        telegramBot?.sendMessage(
          chatId,
          `Yashash manzilingizni kiriting (masalan: Bog'oloni MFY, yashnobot kochasi 49-uy):`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (session.step === 'WAITING_ADDRESS') {
        session.address = text;
        session.step = 'WAITING_CONTENT';
        telegramBot?.sendMessage(
          chatId,
          'Murojaatingiz <b>mazmunini (matnini)</b> batafsil yozib yuboring:',
          { parse_mode: 'HTML' }
        );
        return;
      }

    if (session.step === 'WAITING_CONTENT') {
  // Debug qilish uchun console'ga chiqarib ko'ring:
  console.log("Hozirgi sessiya:", session);

  // Agar orgId sessiyada bo'lmasa, birinchi tashkilotni standart qilib olish (fallback)
  const orgId = session.orgId || (organizations[0] ? organizations[0].id : null);
  const org = organizations.find((o) => o.id === orgId);

  if (!org) {
    telegramBot?.sendMessage(chatId, 'Xatolik yuz berdi: Tashkilot topilmadi. Iltimos, /start buyrug\'idan qayta boshlang.');
    userSessions[chatId] = { step: 'NONE' };
    return;
  }

  const newId = `app-${Date.now()}`;
  const appealNum = `MUR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date();
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const newAppeal: Appeal = {
    id: newId,
    appealNumber: appealNum,
    organizationId: org.id,
    organizationName: org.name,
    fullName: session.fullName || msg.from?.first_name || 'Telegram Foydalanuvchisi',
    phone: session.phone || '+998 Telegram',
    address: session.address || 'Kiritilmagan',
    content: text,
    category: org.category || 'Umumiy',
    createdAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    status: 'yangi',
    feedback: 'kutilmoqda',
    telegramChatId: chatId,
  };

  // Massivga saqlash
  appeals.unshift(newAppeal);
  
  // Terminal logida ko'rish
  console.log("✅ Yangi murojaat bazaga saqlandi:", newAppeal.appealNumber);

  recalculateOrgStats();

  // Sessiyani tozalash
  userSessions[chatId] = { step: 'NONE' };

  telegramBot?.sendMessage(
    chatId,
    `✅ <b>Murojaatingiz tegishli tashkilotga yuborildi</b>\n\n📌 <b>Murojaat №:</b> <code>${appealNum}</code>\n🏢 <b>Tashkilot:</b> ${org.name}\n\nTashkilot mas'ul xodimi o'rganib chiqib, javob va bajarilgan ish fotosini ushbu botga yuboradi`,
    { parse_mode: 'HTML' }
  );
  return;
}
      if (session.step === 'WAITING_OBJECTION' && session.objectionAppealId) {
        const appeal = appeals.find((a) => a.id === session.objectionAppealId);
        if (appeal) {
          appeal.feedback = 'etirozli';
          appeal.objectionText = text;
          appeal.objectionAt = new Date().toISOString();
          recalculateOrgStats();

          telegramBot?.sendMessage(
            chatId,
            `⚠️ <b>E'tirozingiz qabul qilindi!</b>\nSizning e'tirozingiz va murojaatingiz bevosita bosh markaz xizmat tekshiruvi nazoratiga yo'naltirildi.`,
            { parse_mode: 'HTML' }
          );
        }
        userSessions[chatId] = { step: 'NONE' };
        return;
      }
    });

  } catch (err: any) {
    console.error('Failed to initialize Telegram Bot:', err.message);
  }
}

// Helper to notify Telegram user when appeal resolved/updated
async function notifyTelegramUserResolved(appeal: Appeal) {
  if (!telegramBot || !appeal.telegramChatId) return;

  const text = `🏢 <b>Tashkilot:</b> ${appeal.organizationName}\n📌 <b>Murojaat №:</b> <code>${appeal.appealNumber}</code>\n\n✅ <b>SIZNING MUROJAATINGIZ HAL ETILDI!</b>\n\n<b>📝 Tashkilot Ijro Hulosasi:</b>\n${appeal.resolutionText}\n\n<i>Natijadan qanoatlandingizmi? Quyidagi tugmalar orqali baholang:</i>`;

  const inlineKeyboard = [
    [
      { text: '🟢 Roziman (Qanoatlandim)', callback_data: `fb_roziman_${appeal.id}` },
      { text: '🔴 E\'tirozim bor!', callback_data: `fb_etiroz_${appeal.id}` },
    ],
  ];

  try {
    if (appeal.resolutionPhotoUrl) {
      await telegramBot.sendPhoto(appeal.telegramChatId, appeal.resolutionPhotoUrl, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    } else {
      await telegramBot.sendMessage(appeal.telegramChatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    }
  } catch (err) {
    // Fallback if photo fails or blocked
    telegramBot.sendMessage(appeal.telegramChatId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard },
    }).catch(() => {});
  }
}

// API Endpoints

// Bot Status
app.get('/api/telegram/status', (req, res) => {
  res.json(botInfo);
});

// Authentication API Endpoints
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const inputPwd = (password || '').trim();

  if (!inputPwd) {
    return res.status(400).json({ success: false, message: 'Iltimos, maxsus parolni kiriting' });
  }

  // Check if Bosh Kabinet (Admin) password
  if (inputPwd === 'admin123' || inputPwd === 'admin2026') {
    return res.json({ success: true, role: 'bosh_kabinet' });
  }

  // Check if matches any organization password
  const matchedOrg = organizations.find(
    (o) => o.password && o.password.toLowerCase() === inputPwd.toLowerCase()
  );

  if (matchedOrg) {
    return res.json({ success: true, role: 'tashkilot', organization: matchedOrg });
  }

  return res.status(401).json({ success: false, message: 'Kiritilgan maxsus parol noto\'g\'ri' });
});

app.post('/api/auth/tashkilot', (req, res) => {
  const { organizationId, password } = req.body;
  const org = organizations.find((o) => o.id === organizationId);
  if (!org) {
    return res.status(404).json({ success: false, message: 'Tashkilot topilmadi' });
  }
  
  const expectedPassword = org.password || '123456';
  if (password === expectedPassword || password === 'admin123') {
    return res.json({ success: true, organization: org });
  }
  return res.status(401).json({ success: false, message: 'Maxsus parol noto\'g\'ri' });
});

app.post('/api/auth/bosh-kabinet', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123' || password === 'admin2026') {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: 'Bosh Kabinet paroli noto\'g\'ri' });
});

// 1. Get all organizations
app.get('/api/organizations', (req, res) => {
  recalculateOrgStats();
  res.json(organizations);
});

// 2. Add or update organization
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
    password: password || `${code.toLowerCase().replace(/[^a-z0-0]/g, '')}123`,
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

// 3. Get appeals (with filters)
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

  // Sort by newest first
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(filtered);
});

// 4. Submit new appeal (Telegram Bot simulation or web form)
app.post('/api/appeals', (req, res) => {
  const { organizationId, fullName, phone, content, attachmentUrl } = req.body;

  if (!organizationId || !fullName || !phone || !content) {
    return res.status(400).json({ error: 'Barcha talab qilingan maydonlarni to\'ldiring' });
  }

  const org = organizations.find((o) => o.id === organizationId);
  if (!org) {
    return res.status(404).json({ error: 'Tanlangan tashkilot topilmadi' });
  }

  const newId = `app-${Date.now()}`;
  const appealNum = `MUR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const newAppeal: Appeal = {
    id: newId,
    appealNumber: appealNum,
    organizationId: org.id,
    organizationName: org.name,
    fullName,
    phone,
    content,
    attachmentUrl: attachmentUrl || undefined,
    category: org.category,
    createdAt: new Date().toISOString(),
    status: 'yangi',
    feedback: 'kutilmoqda',
  };

  appeals.unshift(newAppeal);
  recalculateOrgStats();

  res.status(201).json(newAppeal);
});

// 5. Accept appeal ("Bajaraman")
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

  // Optionally send update to Telegram if real Telegram chat exists
  if (telegramBot && appeal.telegramChatId) {
    telegramBot.sendMessage(
      appeal.telegramChatId,
      `ℹ️ <b>Murojaatingiz jarayonga olindi!</b>\n📌 № <code>${appeal.appealNumber}</code>\n👤 Mas'ul xodim: ${appeal.assignedOperator}`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  res.json(appeal);
});

// 6. Reject authority ("Mening vakolatimda emas")
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

  if (telegramBot && appeal.telegramChatId) {
    telegramBot.sendMessage(
      appeal.telegramChatId,
      `⚠️ <b>Tashkilot Bildirishnomasi:</b>\n📌 № <code>${appeal.appealNumber}</code>\n${appeal.resolutionText}`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  res.json(appeal);
});

// 7. Resolve appeal (Provide Hulosa & Proof Photo)
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
  appeal.feedback = 'kutilmoqda'; // Citizen will give feedback next

  recalculateOrgStats();

  // PUSH REAL NOTIFICATION TO TELEGRAM USER
  await notifyTelegramUserResolved(appeal);

  res.json(appeal);
});

// 8. Citizen feedback ("Roziman" or "E'tirozim bor")
app.patch('/api/appeals/:id/feedback', (req, res) => {
  const { id } = req.params;
  const { feedback, objectionText } = req.body;

  if (!feedback || (feedback !== 'roziman' && feedback !== 'etirozli')) {
    return res.status(400).json({ error: 'Noto\'g\'ri baholash statusi' });
  }

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

// 9. AI Response Generator via Gemini
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

// Start Express Server
async function startServer() {
  
const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
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

startServer();

