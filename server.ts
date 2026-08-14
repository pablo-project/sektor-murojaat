import express from 'express';
import cors from 'cors';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// React frontend fayllarini tarqatish
app.use(express.static(path.join(__dirname, '../dist')));

// Vaqtinchalik ma'lumotlar ombori
let appeals: any[] = [];
let organizations = [
  { id: '1', name: 'Toshkent Shahar Hokimligi', pendingCount: 0, completedCount: 0 },
  { id: '2', name: 'Sogʻliqni Saqlash Vazirligi', pendingCount: 0, completedCount: 0 }
];

// Gemini AI
const aiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (aiApiKey) {
  aiClient = new GoogleGenAI({ apiKey: aiApiKey });
}

// Telegram Bot
const botToken = process.env.TELEGRAM_BOT_TOKEN;
let bot: any = null;

if (botToken) {
  try {
    bot = new TelegramBot(botToken, { polling: true });
    console.log('✅ Telegram Bot muvaffaqiyatli ishga tushdi!');

    bot.on('message', (msg: any) => {
      // Buyruq bo'lmagan oddiy matnli murojaatlarni ushlaymiz
      if (msg.text && !msg.text.startsWith('/')) {
        const newAppeal = {
          id: Date.now().toString(),
          citizenName: msg.from?.first_name || msg.from?.username || 'Fuqaro',
          telegramChatId: msg.chat.id,
          text: msg.text,
          organizationId: '1',
          status: 'NEW',
          createdAt: new Date().toISOString(),
          aiResponse: ''
        };

        appeals.unshift(newAppeal); // Yangi murojaatni eng tepaga qo'shamiz
        console.log('📥 Yangi murojaat dashbord uchun saqlandi:', newAppeal);

        bot.sendMessage(
          msg.chat.id,
          `✅ **Murojaatingiz qabul qilindi!**\n\n📌 **Murojaat ID:** #${newAppeal.id}\n📄 **Matn:** ${msg.text}\n\nTez orada mas'ul xodimlar ko'rib chiqadi.`
        );
      } else if (msg.text === '/start') {
        bot.sendMessage(
          msg.chat.id,
          `Assalomu alaykum, ${msg.from?.first_name || 'fuqaro'}!\n\nMurojaatingizni yuboring, u avtomatik ravishda boshqaruv paneliga yo'naltiriladi.`
        );
      }
    });

    bot.on('callback_query', (query: any) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (data?.startsWith('approve_')) {
        const appealId = data.replace('approve_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) appeal.status = 'COMPLETED';

        bot.sendMessage(chatId, '✅ Murojaat qoniqarli deb topildi va yopildi. Rahmat!');
      } else if (data?.startsWith('reject_')) {
        const appealId = data.replace('reject_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) appeal.status = 'ESCALATED';

        bot.sendMessage(
          chatId,
          '🚨 Javobdan qoniqmaganingiz sababli murojaat Bosh Kabinet (Super Admin) nazoratiga o\'tkazildi.'
        );
      }
    });
  } catch (err) {
    console.error('❌ Telegram botni ishga tushirishda xatolik:', err);
  }
}

// REST API Endpoints
app.get('/api/appeals', (req, res) => {
  res.json(appeals);
});

app.post('/api/appeals', (req, res) => {
  const newAppeal = {
    id: Date.now().toString(),
    citizenName: req.body.citizenName || 'Fuqaro',
    telegramChatId: req.body.telegramChatId || null,
    text: req.body.text,
    organizationId: req.body.organizationId || '1',
    status: 'NEW',
    createdAt: new Date().toISOString(),
    aiResponse: ''
  };
  appeals.unshift(newAppeal);
  res.status(201).json(newAppeal);
});

app.patch('/api/appeals/:id', (req, res) => {
  const { id } = req.params;
  const { status, aiResponse } = req.body;
  const appeal = appeals.find((a) => a.id === id);

  if (!appeal) return res.status(404).json({ error: 'Murojaat topilmadi' });

  if (status) appeal.status = status;
  if (aiResponse) appeal.aiResponse = aiResponse;

  if (status === 'PENDING_USER_APPROVAL' && appeal.telegramChatId && bot) {
    bot.sendMessage(
      appeal.telegramChatId,
      `📋 **Murojaatingizga javob tayyorlandi:**\n\n${aiResponse}\n\nJavobdan qoniqdingizmi?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Roziman', callback_data: `approve_${appeal.id}` }],
            [{ text: '❌ E\'tirozim bor!', callback_data: `reject_${appeal.id}` }]
          ]
        }
      }
    );
  }

  res.json(appeal);
});

app.post('/api/ai/generate-response', async (req, res) => {
  const { appealText } = req.body;
  if (!aiClient) {
    return res.status(500).json({ error: 'GEMINI_API_KEY sozlanmagan' });
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Siz davlat tashkiloti rasmiy vakilisiz. Ushbu fuqaro murojaatiga mos, xushmuomala, rasmiy va qonuniy javob matni loyihasini tayyorlang:\n"${appealText}"`
    });

    res.json({ responseText: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Barcha boshqa yo'llarda React index.html faylini berish
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));