import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import TelegramBot from 'node-telegram-bot-api';
import { Organization, Appeal } from './src/types.js';
import { INITIAL_ORGANIZATIONS, INITIAL_APPEALS } from './src/data/initialData.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Persistent Data Storage (JSON file on disk)
const STORAGE_FILE = path.join(process.cwd(), 'data-storage.json');

let organizations: Organization[] = [...INITIAL_ORGANIZATIONS];
let appeals: Appeal[] = [...INITIAL_APPEALS];

// Load persisted data if file exists
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
    }
  } catch (err) {
    console.error('Failed to load persisted data:', err);
  }
}

// Save data to disk
function savePersistedData() {
  try {
    fs.writeFileSync(
      STORAGE_FILE,
      JSON.stringify({ appeals, organizations }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to save persisted data:', err);
  }
}

loadPersistedData();

// Gemini API instance
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Telegram Bot Instance
let telegramBot: TelegramBot | null = null;
let botInfo: any = null;
let botToken: string | null = process.env.TELEGRAM_BOT_TOKEN || null;

// In-memory user state for Telegram bot conversational flow
interface TelegramUserState {
  step:
    | 'IDLE'
    | 'AWAITING_ORG'
    | 'AWAITING_FULLNAME'
    | 'AWAITING_PHONE'
    | 'AWAITING_ADDRESS'
    | 'AWAITING_CONTENT'
    | 'AWAITING_OBJECTION';
  selectedOrgId?: string;
  selectedOrgName?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  content?: string;
  photoUrl?: string;
  targetAppealId?: string;
}

const userStates = new Map<number, TelegramUserState>();

async function initTelegramBot(tokenToUse?: string) {
  const token = tokenToUse || botToken;
  if (!token) {
    console.log('Telegram Bot Token mavjud emas. Bot ishga tushirilmadi.');
    return;
  }

  try {
    if (telegramBot) {
      try {
        await telegramBot.stopPolling();
      } catch (e) {
        // ignore
      }
    }

    telegramBot = new TelegramBot(token, { polling: true });
    botToken = token;
    botInfo = await telegramBot.getMe();
    console.log(`Telegram Bot faollashtirildi: @${botInfo.username}`);

    // Listen for polling errors to prevent crash
    telegramBot.on('polling_error', (error) => {
      console.error('Telegram Polling Error:', error.message);
    });

    // Command /start
    telegramBot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      userStates.set(chatId, { step: 'IDLE' });

      const keyboard = {
        reply_markup: {
          keyboard: [
            [{ text: '📝 Yangi murojaat yuborish' }],
            [{ text: '📋 Mening murojaatlarim holati' }],
            [{ text: '🏢 Tashkilotlar ro‘yxati' }, { text: 'ℹ️ Yordam' }],
          ],
          resize_keyboard: true,
        },
      };

      await telegramBot?.sendMessage(
        chatId,
        `Assalomu alaykum, ${msg.from?.first_name || 'Hurmatli fuqaro'}!\n\n` +
          `🏛 **Sektor Murojaat va Nazorat Portalining** rasmiy Telegram botiga xush kelibsiz.\n\n` +
          `Ushbu bot orqali tuman/shahar tashkilotlariga to‘g‘ridan-to‘g‘ri murojaat yuborishingiz va ularning ijro holatini kuzatib borishingiz mumkin.`,
        { parse_mode: 'Markdown', ...keyboard }
      );
    });

    // Button: Yangi murojaat yuborish
    telegramBot.onText(/📝 Yangi murojaat yuborish/, async (msg) => {
      const chatId = msg.chat.id;
      userStates.set(chatId, { step: 'AWAITING_ORG' });

      const inlineKeyboard = organizations.map((org) => [
        {
          text: org.name,
          callback_data: `select_org_${org.id}`,
        },
      ]);

      await telegramBot?.sendMessage(
        chatId,
        `Qaysi tashkilotga murojaat yubormoqchisiz? Quyidagi ro'yxatdan tanlang:`,
        {
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }
      );
    });

    // Button: Mening murojaatlarim
    telegramBot.onText(/📋 Mening murojaatlarim holati/, async (msg) => {
      const chatId = msg.chat.id;
      const userAppeals = appeals.filter((a) => a.telegramChatId === chatId);

      if (userAppeals.length === 0) {
        await telegramBot?.sendMessage(
          chatId,
          `Siz hali ushbu bot orqali murojaat yubormagansiz.\n"📝 Yangi murojaat yuborish" tugmasini bosib ariza qoldirishingiz mumkin.`
        );
        return;
      }

      let response = `📋 **Sizning barcha murojaatlaringiz (${userAppeals.length} ta):**\n\n`;
      userAppeals.forEach((appItem, idx) => {
        const statusBadge =
          appItem.status === 'hal_etildi'
            ? '✅ Hal etilgan'
            : appItem.status === 'rad_etildi'
            ? '❌ Rad etilgan'
            : '⏳ Jarayonda';

        response += `*${idx + 1}. № ${appItem.appealNumber}*\n`;
        response += `🏢 Tashkilot: ${appItem.organizationName}\n`;
        response += `📌 Holati: ${statusBadge}\n`;
        if (appItem.status === 'hal_etildi' && appItem.resolutionText) {
          response += `💬 Tashkilot javobi: ${appItem.resolutionText}\n`;
        }
        response += `📅 Sana: ${new Date(appItem.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
      });

      await telegramBot?.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });

    // Button: Tashkilotlar ro'yxati
    telegramBot.onText(/🏢 Tashkilotlar ro‘yxati/, async (msg) => {
      const chatId = msg.chat.id;
      let orgsList = `🏢 **Tumandagi mas'ul tashkilotlar ro'yxati:**\n\n`;
      organizations.forEach((org, index) => {
        orgsList += `${index + 1}. **${org.name}**\n`;
        if (org.phone) orgsList += `   📞 Tel: ${org.phone}\n`;
        if (org.leaderName) orgsList += `   👤 Rahbar: ${org.leaderName}\n`;
        orgsList += `   📊 Jami murojaatlar: ${org.totalAppeals || 0} ta\n\n`;
      });

      await telegramBot?.sendMessage(chatId, orgsList, { parse_mode: 'Markdown' });
    });

    // Button: Yordam
    telegramBot.onText(/ℹ️ Yordam/, async (msg) => {
      const chatId = msg.chat.id;
      await telegramBot?.sendMessage(
        chatId,
        `💡 **Yordam va qo‘llanma:**\n\n` +
          `1. "📝 Yangi murojaat yuborish" tugmasini bosing.\n` +
          `2. Ro‘yxatdan muammo tegishli bo‘lgan tashkilotni tanlang.\n` +
          `3. Ism-familiyangiz, telefon raqamingiz va manzilingizni kiriting.\n` +
          `4. Murojaat matnini yozing (ixtiyoriy rasm bilan).\n` +
          `5. Murojaatingiz darhol mas'ul tashkilot kabinetiga tushadi va ko'rib chiqiladi.`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle Callback queries
    telegramBot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message?.chat.id;
      const data = callbackQuery.data;

      if (!chatId || !data) return;

      if (data.startsWith('select_org_')) {
        const orgId = data.replace('select_org_', '');
        const selectedOrg = organizations.find((o) => o.id === orgId);

        if (selectedOrg) {
          userStates.set(chatId, {
            step: 'AWAITING_FULLNAME',
            selectedOrgId: selectedOrg.id,
            selectedOrgName: selectedOrg.name,
          });

          await telegramBot?.answerCallbackQuery(callbackQuery.id);
          await telegramBot?.sendMessage(
            chatId,
            `Tanlangan tashkilot: *${selectedOrg.name}*\n\n` +
              `Iltimos, to‘liq **Familiyangiz, Ismingiz va Otangizning ismini** kiriting:`,
            { parse_mode: 'Markdown' }
          );
        }
      } else if (data.startsWith('feedback_agree_')) {
        const appealId = data.replace('feedback_agree_', '');
        const target = appeals.find((a) => a.id === appealId);
        if (target) {
          target.feedback = 'roziman';
          savePersistedData();
          await telegramBot?.answerCallbackQuery(callbackQuery.id, {
            text: 'Rahmat! Fikringiz qabul qilindi.',
          });
          await telegramBot?.sendMessage(
            chatId,
            `✅ Sizning javobingiz qabul qilindi: **Roziman**. Baholaganingiz uchun tashakkur!`
          );
        }
      } else if (data.startsWith('feedback_object_')) {
        const appealId = data.replace('feedback_object_', '');
        const target = appeals.find((a) => a.id === appealId);
        if (target) {
          userStates.set(chatId, {
            step: 'AWAITING_OBJECTION',
            targetAppealId: appealId,
          });
          await telegramBot?.answerCallbackQuery(callbackQuery.id);
          await telegramBot?.sendMessage(
            chatId,
            `🔴 E'tirozingiz sababini yozib yuboring:\n(Masalan: muammo to'liq hal etilmadi, ish oxiriga yetkazilmadi va h.k.)`
          );
        }
      }
    });

    // Text & Message handler (Step-by-step state machine)
    telegramBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();
      const state = userStates.get(chatId);

      if (!state || state.step === 'IDLE' || text?.startsWith('/')) {
        return;
      }

      // Ignore main menu buttons triggered by mistake in steps
      if (text === '📝 Yangi murojaat yuborish' || text === '📋 Mening murojaatlarim holati' || text === '🏢 Tashkilotlar ro‘yxati' || text === 'ℹ️ Yordam') {
        return;
      }

      if (state.step === 'AWAITING_FULLNAME' && text) {
        state.fullName = text;
        state.step = 'AWAITING_PHONE';
        userStates.set(chatId, state);

        await telegramBot?.sendMessage(
          chatId,
          `Rahmat, ${text}!\n\nBog‘lanish uchun **telefon raqamingizni** kiriting (masalan: +998901234567) yoki quyidagi tugma orqali yuboring:`,
          {
            reply_markup: {
              keyboard: [
                [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
                [{ text: 'Bekor qilish' }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
      } else if (state.step === 'AWAITING_PHONE') {
        let phoneNum = msg.contact?.phone_number || text;
        if (text === 'Bekor qilish') {
          userStates.set(chatId, { step: 'IDLE' });
          await telegramBot?.sendMessage(chatId, 'Murojaat bekor qilindi.', {
            reply_markup: {
              keyboard: [
                [{ text: '📝 Yangi murojaat yuborish' }],
                [{ text: '📋 Mening murojaatlarim holati' }],
                [{ text: '🏢 Tashkilotlar ro‘yxati' }, { text: 'ℹ️ Yordam' }],
              ],
              resize_keyboard: true,
            },
          });
          return;
        }

        if (phoneNum) {
          if (!phoneNum.startsWith('+') && !phoneNum.startsWith('998')) {
            phoneNum = `+998${phoneNum}`;
          }
          state.phone = phoneNum;
          state.step = 'AWAITING_ADDRESS';
          userStates.set(chatId, state);

          await telegramBot?.sendMessage(
            chatId,
            `Yashash **manzilingizni** kiriting (tuman, MFY, ko'cha, uy raqami):`,
            {
              reply_markup: {
                keyboard: [[{ text: 'Bekor qilish' }]],
                resize_keyboard: true,
              },
            }
          );
        }
      } else if (state.step === 'AWAITING_ADDRESS' && text) {
        if (text === 'Bekor qilish') {
          userStates.set(chatId, { step: 'IDLE' });
          await telegramBot?.sendMessage(chatId, 'Murojaat bekor qilindi.');
          return;
        }

        state.address = text;
        state.step = 'AWAITING_CONTENT';
        userStates.set(chatId, state);

        await telegramBot?.sendMessage(
          chatId,
          `Endi murojaatingizning **batafsil mazmunini** yozing (agar kerak bo'lsa rasm bilan birga yuborishingiz mumkin):`,
          {
            reply_markup: {
              keyboard: [[{ text: 'Bekor qilish' }]],
              resize_keyboard: true,
            },
          }
        );
      } else if (state.step === 'AWAITING_CONTENT') {
        if (text === 'Bekor qilish') {
          userStates.set(chatId, { step: 'IDLE' });
          await telegramBot?.sendMessage(chatId, 'Murojaat bekor qilindi.');
          return;
        }

        const contentText = text || msg.caption || '(Faqat rasm yoki fayl ilova qilindi)';
        let photoUrl: string | undefined = undefined;

        if (msg.photo && msg.photo.length > 0) {
          const largestPhoto = msg.photo[msg.photo.length - 1];
          try {
            const fileLink = await telegramBot?.getFileLink(largestPhoto.file_id);
            photoUrl = fileLink;
          } catch (e) {
            console.error('Failed to get photo link:', e);
          }
        }

        const appealNum = `MUR-${new Date().getFullYear()}-${String(appeals.length + 1).padStart(3, '0')}`;
        const selectedOrg = organizations.find((o) => o.id === state.selectedOrgId);

        const now = new Date();
        const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const newAppeal: Appeal = {
          id: `appeal-${Date.now()}`,
          appealNumber: appealNum,
          organizationId: state.selectedOrgId || 'org-1',
          organizationName: state.selectedOrgName || 'Tashkilot',
          fullName: state.fullName || 'Fuqaro',
          phone: state.phone || '',
          address: state.address || '',
          content: contentText,
          category: selectedOrg?.category || 'Umumiy',
          createdAt: now.toISOString(),
          deadlineAt: deadline.toISOString(),
          status: 'jarayonda',
          feedback: 'kutilmoqda',
          telegramChatId: chatId,
          attachmentUrl: photoUrl,
        };

        appeals.unshift(newAppeal);

        // Update org stats
        if (selectedOrg) {
          selectedOrg.totalAppeals = (selectedOrg.totalAppeals || 0) + 1;
          selectedOrg.inProgressAppeals = (selectedOrg.inProgressAppeals || 0) + 1;
        }

        savePersistedData();
        userStates.set(chatId, { step: 'IDLE' });

        const finalKeyboard = {
          reply_markup: {
            keyboard: [
              [{ text: '📝 Yangi murojaat yuborish' }],
              [{ text: '📋 Mening murojaatlarim holati' }],
              [{ text: '🏢 Tashkilotlar ro‘yxati' }, { text: 'ℹ️ Yordam' }],
            ],
            resize_keyboard: true,
          },
        };

        await telegramBot?.sendMessage(
          chatId,
          `✅ **Murojaatingiz muvaffaqiyatli qabul qilindi!**\n\n` +
            `📄 **Raqami:** \`${appealNum}\`\n` +
            `🏢 **Mas'ul tashkilot:** ${state.selectedOrgName}\n` +
            `⏳ **Ijro muddati:** 7 kun (${deadline.toLocaleDateString('uz-UZ')} gacha)\n\n` +
            `Murojaatingiz ijro holati o‘zgarganda sizga ushbu bot orqali xabar beriladi.`,
          { parse_mode: 'Markdown', ...finalKeyboard }
        );
      } else if (state.step === 'AWAITING_OBJECTION' && text && state.targetAppealId) {
        const target = appeals.find((a) => a.id === state.targetAppealId);
        if (target) {
          target.feedback = 'e`tiroz';
          target.objectionReason = text;
          target.status = 'jarayonda'; // Re-open if citizen objected
          savePersistedData();

          await telegramBot?.sendMessage(
            chatId,
            `⚠️ E'tirozingiz qabul qilindi! Murojaat qayta ko'rib chiqish uchun mas'ul tashkilotga yo'naltirildi.`
          );
        }
        userStates.set(chatId, { step: 'IDLE' });
      }
    });
  } catch (error) {
    console.error('Telegram Bot init error:', error);
  }
}

initTelegramBot();

// API Routes

// GET Organizations
app.get('/api/organizations', (req, res) => {
  res.json(organizations);
});

// POST New Organization
app.post('/api/organizations', (req, res) => {
  const { name, shortName, category, phone, email, address, leaderName, password } = req.body;
  const newOrg: Organization = {
    id: `org-${Date.now()}`,
    name,
    shortName: shortName || name,
    category,
    phone: phone || '',
    email: email || '',
    address: address || '',
    leaderName: leaderName || '',
    password: password || '123456',
    totalAppeals: 0,
    completedAppeals: 0,
    inProgressAppeals: 0,
    expiredAppeals: 0,
    rejectedAuthorityAppeals: 0,
  };
  organizations.push(newOrg);
  savePersistedData();
  res.status(201).json(newOrg);
});

// PUT Update Organization
app.put('/api/organizations/:id', (req, res) => {
  const { id } = req.params;
  const index = organizations.findIndex((o) => o.id === id);
  if (index !== -1) {
    organizations[index] = { ...organizations[index], ...req.body };
    savePersistedData();
    res.json(organizations[index]);
  } else {
    res.status(404).json({ error: 'Tashkilot topilmadi' });
  }
});

// DELETE Organization
app.delete('/api/organizations/:id', (req, res) => {
  const { id } = req.params;
  organizations = organizations.filter((o) => o.id !== id);
  appeals = appeals.filter((a) => a.organizationId !== id);
  savePersistedData();
  res.json({ success: true });
});

// GET Appeals
app.get('/api/appeals', (req, res) => {
  res.json(appeals);
});

// POST New Appeal
app.post('/api/appeals', (req, res) => {
  const {
    organizationId,
    organizationName,
    fullName,
    phone,
    address,
    content,
    category,
    days = 7,
    attachmentUrl,
  } = req.body;

  const now = new Date();
  const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const appealNum = `MUR-${now.getFullYear()}-${String(appeals.length + 1).padStart(3, '0')}`;

  const newAppeal: Appeal = {
    id: `appeal-${Date.now()}`,
    appealNumber: appealNum,
    organizationId,
    organizationName,
    fullName,
    phone,
    address,
    content,
    category: category || 'Umumiy',
    createdAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    status: 'jarayonda',
    feedback: 'kutilmoqda',
    attachmentUrl,
  };

  appeals.unshift(newAppeal);

  // Update org stats
  const org = organizations.find((o) => o.id === organizationId);
  if (org) {
    org.totalAppeals = (org.totalAppeals || 0) + 1;
    org.inProgressAppeals = (org.inProgressAppeals || 0) + 1;
  }

  savePersistedData();
  res.status(201).json(newAppeal);
});

// PUT Update Appeal Status / Resolution
app.put('/api/appeals/:id', async (req, res) => {
  const { id } = req.params;
  const appeal = appeals.find((a) => a.id === id);

  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  const {
    status,
    resolutionText,
    resolutionPhotoUrl,
    assignedOperator,
    startedAt,
    resolvedAt,
    rejectedAuthorityReason,
    feedback,
    attachmentUrl,
  } = req.body;

  const oldStatus = appeal.status;

  if (status !== undefined) appeal.status = status;
  if (resolutionText !== undefined) appeal.resolutionText = resolutionText;
  if (resolutionPhotoUrl !== undefined) appeal.resolutionPhotoUrl = resolutionPhotoUrl;
  if (assignedOperator !== undefined) appeal.assignedOperator = assignedOperator;
  if (startedAt !== undefined) appeal.startedAt = startedAt;
  if (resolvedAt !== undefined) appeal.resolvedAt = resolvedAt;
  if (rejectedAuthorityReason !== undefined) appeal.rejectedAuthorityReason = rejectedAuthorityReason;
  if (feedback !== undefined) appeal.feedback = feedback;
  if (attachmentUrl !== undefined) appeal.attachmentUrl = attachmentUrl;

  savePersistedData();

  // If status changed to 'hal_etildi' and telegramChatId exists, send notification to citizen
  if (status === 'hal_etildi' && oldStatus !== 'hal_etildi' && appeal.telegramChatId) {
    try {
      await sendAppealResolvedNotification(appeal);
    } catch (e) {
      console.error('Notification error:', e);
    }
  }

  res.json(appeal);
});

// Notification Helper to Citizen via Telegram
async function sendAppealResolvedNotification(appeal: Appeal) {
  if (!telegramBot || !appeal.telegramChatId) return;

  const message =
    `🎉 **Murojaatingiz ko'rib chiqildi va hal etildi!**\n\n` +
    `📄 **Murojaat raqami:** \`${appeal.appealNumber}\`\n` +
    `🏢 **Tashkilot:** ${appeal.organizationName}\n` +
    `💬 **Bajarilgan ish / Hulosa:** ${appeal.resolutionText || 'Masala yuzasidan amaliy choralar ko‘rildi.'}\n\n` +
    `Iltimos, tashkilot tomonidan bajarilgan ish sifatini baholang:`;

  const feedbackKeyboard = {
    inline_keyboard: [
      [
        { text: '👍 Roziman (Ijobiy)', callback_data: `feedback_agree_${appeal.id}` },
        { text: '👎 E\'tirozim bor', callback_data: `feedback_object_${appeal.id}` },
      ],
    ],
  };

  if (appeal.resolutionPhotoUrl) {
    try {
      await telegramBot.sendPhoto(appeal.telegramChatId, appeal.resolutionPhotoUrl, {
        caption: message,
        parse_mode: 'Markdown',
        reply_markup: feedbackKeyboard,
      });
      return;
    } catch (err) {
      // fallback to text if photo send fails
    }
  }

  await telegramBot.sendMessage(appeal.telegramChatId, message, {
    parse_mode: 'Markdown',
    reply_markup: feedbackKeyboard,
  });
}

// Generic Telegram Notification endpoint
async function sendAppealUpdateNotification(appealId: string, customMessage: string) {
  const appeal = appeals.find((a) => a.id === appealId);
  if (!appeal || !appeal.telegramChatId || !telegramBot) return false;

  try {
    await telegramBot.sendMessage(
      appeal.telegramChatId,
      `🔔 **Murojaatingiz bo'yicha yangi xabar:**\n\n` +
        `📄 Murojaat №: \`${appeal.appealNumber}\`\n\n` +
        `${customMessage}`,
      { parse_mode: 'Markdown' }
    );
    return true;
  } catch (e) {
    console.error('Failed to send telegram update:', e);
    return false;
  }
}

// POST Configure Telegram Bot
app.post('/api/telegram/configure', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token kiritilmadi' });
  }

  try {
    await initTelegramBot(token);
    res.json({
      success: true,
      bot: botInfo,
      message: `Bot muvaffaqiyatli ulandi: @${botInfo?.username}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Botni faollashtirishda xatolik' });
  }
});

// GET Telegram Bot Status
app.get('/api/telegram/status', (req, res) => {
  res.json({
    isActive: !!telegramBot,
    username: botInfo?.username || null,
    token: botToken ? `${botToken.substring(0, 8)}...` : null,
  });
});

// POST Send Telegram Notification
app.post('/api/telegram/send-notification', async (req, res) => {
  const { appealId, message } = req.body;
  if (!appealId || !message) {
    return res.status(400).json({ error: 'appealId va message majburiy' });
  }

  const success = await sendAppealUpdateNotification(appealId, message);
  res.json({ success });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: botInfo,
    appealsCount: appeals.length,
    organizationsCount: organizations.length,
  });
});

// Catch-all for unhandled /api routes so they return JSON, not HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint topilmadi: ${req.method} ${req.path}` });
});

// Start Express Server
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});