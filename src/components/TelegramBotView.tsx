import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, AlertCircle, Phone, User, Building, FileText, Image, ThumbsUp, ThumbsDown, MessageSquare, Clock, ArrowRight, ShieldAlert, Sparkles, Bot, Key, Check } from 'lucide-react';
import { Organization, Appeal, BotStatusInfo } from '../types';

interface TelegramBotViewProps {
  organizations: Organization[];
  appeals: Appeal[];
  onSubmitAppeal: (appealData: {
    organizationId: string;
    fullName: string;
    phone: string;
    content: string;
    attachmentUrl?: string;
  }) => Promise<void>;
  onSubmitFeedback: (appealId: string, feedback: 'roziman' | 'etirozli', objectionText?: string) => Promise<void>;
  isLoading: boolean;
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  organizations,
  appeals,
  onSubmitAppeal,
  onSubmitFeedback,
  isLoading,
}) => {
  // Bot step state
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('+998 ');
  const [content, setContent] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'create' | 'my_appeals'>('create');
  
  // Real Telegram Bot status
  const [botStatus, setBotStatus] = useState<BotStatusInfo>({ isActive: false });
  const [showTokenGuide, setShowTokenGuide] = useState<boolean>(false);

  // Objection Modal
  const [objectionModalAppealId, setObjectionModalAppealId] = useState<string | null>(null);
  const [objectionReason, setObjectionReason] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/telegram/status')
      .then((res) => res.json())
      .then((data: BotStatusInfo) => setBotStatus(data))
      .catch((err) => console.error('Bot status error:', err));
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !fullName.trim() || !phone.trim() || !content.trim()) {
      alert('Iltimos, barcha zaruriy maydonlarni to\'ldiring.');
      return;
    }

    try {
      await onSubmitAppeal({
        organizationId: selectedOrgId,
        fullName,
        phone,
        content,
        attachmentUrl: attachmentUrl || undefined,
      });

      setSuccessMessage('Murojaatingiz muvaffaqiyatli qabul qilindi! Boshqaruv paneliga yuborildi.');
      setContent('');
      setAttachmentUrl('');
      setActiveTab('my_appeals');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      alert('Murojaat yuborishda xatolik yuz berdi.');
    }
  };

  const handleSatisfied = async (appealId: string) => {
    await onSubmitFeedback(appealId, 'roziman');
    alert('E\'tiboringiz va bahoingiz uchun rahmat! Murojaat yopildi.');
  };

  const handleObjectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectionModalAppealId || !objectionReason.trim()) return;

    await onSubmitFeedback(objectionModalAppealId, 'etirozli', objectionReason);
    setObjectionModalAppealId(null);
    setObjectionReason('');
    alert('E\'tirozingiz qabul qilindi va bevosita BOSH KABINET  nazoratiga yuborildi!');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      
      {/* Unified Telegram Bot Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className={`p-3 rounded-xl text-white shadow-lg flex-shrink-0 ${botStatus.isActive ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-blue-600 shadow-blue-600/30'}`}>
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-100">
                {botStatus.isActive 
                  ? `Telegram Bot (@${botStatus.botUsername})` 
                  : 'Rasmiy Telegram Bot & Simulyator'}
              </h2>
              {botStatus.isActive ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  🟢 Faol Telegram Bot
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  ⚡ Web Simulyator Rejimi
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fuqarolar bot orqali murojaat yo'llaydi, statusini kuzatadi hamda hal qilingach baholaydi.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end md:self-auto flex-wrap gap-y-2">
          {botStatus.isActive && botStatus.botUsername ? (
            <a
              href={`https://t.me/${botStatus.botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow flex items-center space-x-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegramda Ochish</span>
            </a>
          ) : (
            <button
              onClick={() => setShowTokenGuide(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow flex items-center space-x-1.5 transition-all"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Bot Tokenni Ulash</span>
            </button>
          )}

          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              id="bot-nav-create"
              onClick={() => setActiveTab('create')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              + Yangi Murojaat
            </button>
            <button
              id="bot-nav-my-appeals"
              onClick={() => setActiveTab('my_appeals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                activeTab === 'my_appeals'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>Murojaatlarim</span>
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-200 rounded-full font-bold">
                {appeals.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center space-x-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Main Telegram Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Telegram Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-inner">
              🤖
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-bold text-sm text-slate-100">Rasmiy Murojaat Boti</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>
              <p className="text-[11px] text-slate-400">bot online • @MurojaatXizmatiBot</p>
            </div>
          </div>
          <span className="text-xs font-medium bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
            {activeTab === 'create' ? 'Yangi Yozish' : 'Tarix va Status'}
          </span>
        </div>

        {/* Tab Content 1: Create Appeal Form */}
        {activeTab === 'create' && (
          <div className="p-6 bg-slate-50/50">
            <form onSubmit={handleFormSubmit} className="space-y-5">
              
              {/* Step 1: Organization Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Building className="w-4 h-4 text-sky-600" />
                  <span>1. Tegishli Tashkilotni Tanlang *</span>
                </label>
                <select
                  id="bot-select-organization"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm"
                >
                  <option value="">-- Murojaatingiz qaysi tashkilotga tegishli? --</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      🏢 {org.name} ({org.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-sky-600" />
                    <span>2. Ism va Familiyangiz *</span>
                  </label>
                  <input
                    id="bot-input-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masalan: Anvar Karimov"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Phone className="w-4 h-4 text-sky-600" />
                    <span>3. Telefon Raqamingiz *</span>
                  </label>
                  <input
                    id="bot-input-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 123-45-67"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Step 3: Appeal Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>4. Murojaat Mazmuni (Matni) *</span>
                </label>
                <textarea
                  id="bot-input-content"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Murojaatingizni batafsil yozing (masalan, muammo nimada, qaysi manzilda va nimani amaliy hal etilishini so'raysiz)..."
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl p-4 text-sm text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm"
                />
              </div>

              {/* Step 4: Optional Attachment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Image className="w-4 h-4 text-sky-600" />
                  <span>5. Rasm yoki Fayl Biriktirish (Ixtiyoriy)</span>
                </label>
                <input
                  id="bot-input-attachment"
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... (yoki rasm havolasi)"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="bot-btn-submit-appeal"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-sky-600/25 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Murojaatni Yuborish (Botga Yo'llash)</span>
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Tab Content 2: My Appeals List & Feedbacks */}
        {activeTab === 'my_appeals' && (
          <div className="p-6 bg-slate-100/70 min-h-[400px]">
            {appeals.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700">Hozircha murojaatlaringiz yo'q</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Yuqoridagi "+ Yangi Murojaat" tugmasini bosib birinchi murojaatingizni yo'llashingiz mumkin.
                </p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg shadow"
                >
                  Murojaat Yaratish
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {appeals.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="bg-sky-100 text-sky-800 font-mono text-xs font-bold px-2.5 py-1 rounded-md">
                          {item.appealNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          🏢 {item.organizationName}
                        </span>
                      </div>

                      {/* Status badge */}
                      <div>
                        {item.status === 'yangi' && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-bold flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>Yangi (Kutilmoqda)</span>
                          </span>
                        )}
                        {item.status === 'jarayonda' && (
                          <span className="bg-blue-100 text-blue-800 border border-blue-200 text-xs px-2.5 py-1 rounded-full font-bold flex items-center space-x-1">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>Bajarilmoqda</span>
                          </span>
                        )}
                        {item.status === 'hal_etildi' && (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Hal Etildi</span>
                          </span>
                        )}
                        {item.status === 'vakolatda_emas' && (
                          <span className="bg-rose-100 text-rose-800 border border-rose-200 text-xs px-2.5 py-1 rounded-full font-bold flex items-center space-x-1">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Vakolatda Emas (Qayta Yo'naltirildi)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                      {/* User input summary */}
                      <div>
                        <div className="text-xs text-slate-500 mb-1 flex items-center space-x-2">
                          <span className="font-semibold text-slate-700">{item.fullName}</span>
                          <span>•</span>
                          <span>{item.phone}</span>
                          <span>•</span>
                          <span>{new Date(item.createdAt).toLocaleString('uz-UZ')}</span>
                        </div>
                        <p className="text-sm text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          {item.content}
                        </p>
                      </div>

                      {item.assignedOperator && item.status === 'jarayonda' && (
                        <div className="text-xs bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 text-blue-600" />
                          <span>Mas'ul ijrochi tayinlandi: <strong>{item.assignedOperator}</strong></span>
                        </div>
                      )}

                      {/* Resolution View when Resolved */}
                      {item.status === 'hal_etildi' && (
                        <div className="mt-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Tashkilot Ijro Hulosasi va Isboti</span>
                          </div>

                          <p className="text-sm text-slate-800 bg-white p-3 rounded-xl border border-emerald-100">
                            {item.resolutionText}
                          </p>

                          {item.resolutionPhotoUrl && (
                            <div>
                              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                                📷 Bajarilgan ish rasmi (Isbot):
                              </span>
                              <img
                                src={item.resolutionPhotoUrl}
                                alt="Bajarilgan ish foto-isboti"
                                className="w-full max-h-60 object-cover rounded-xl border border-slate-200"
                              />
                            </div>
                          )}

                          {/* Interactive Feedback Buttons */}
                          <div className="pt-2 border-t border-emerald-200/80">
                            <span className="text-xs font-bold text-slate-700 block mb-2">
                              Natijadan qanoatlandingizmi? (Tashkilot xizmatiga baho bering):
                            </span>

                            {item.feedback === 'kutilmoqda' ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <button
                                  id={`btn-satisfied-${item.id}`}
                                  onClick={() => handleSatisfied(item.id)}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow flex items-center justify-center space-x-2 transition-all"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                  <span>Roziman (Qanoatlandim)</span>
                                </button>

                                <button
                                  id={`btn-objection-${item.id}`}
                                  onClick={() => setObjectionModalAppealId(item.id)}
                                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow flex items-center justify-center space-x-2 transition-all"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                  <span>E'tirozim bor!</span>
                                </button>
                              </div>
                            ) : item.feedback === 'roziman' ? (
                              <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold p-2.5 rounded-xl flex items-center space-x-2">
                                <ThumbsUp className="w-4 h-4 text-emerald-700" />
                                <span>Siz "ROZIMAN" tugmasini bosdingiz. Murojaat ijobiy yopildi.</span>
                              </div>
                            ) : (
                              <div className="bg-rose-100 border border-rose-300 text-rose-900 text-xs p-3 rounded-xl space-y-1">
                                <div className="font-bold flex items-center space-x-1.5 text-rose-800">
                                  <ShieldAlert className="w-4 h-4" />
                                  <span>Siz "E'TIROZIM BOR" tugmasini bosdingiz!</span>
                                </div>
                                <p className="text-xs text-rose-950 font-medium bg-white/80 p-2 rounded-lg border border-rose-200">
                                  E'tiroz sababi: "{item.objectionText}"
                                </p>
                                <span className="text-[10px] text-rose-700 block font-semibold">
                                  ⚠️ Ushbu e'tiroz va murojaat BOSH KABINET nazoratiga yuborildi.
                                </span>
                              </div>
                            )}
                          </div>

                        </div>
                      )}

                      {item.status === 'vakolatda_emas' && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl space-y-1">
                          <span className="font-bold block">
                            ⚠️ Tashkilot xabarnomasi:
                          </span>
                          <p>{item.resolutionText}</p>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Objection Modal */}
      {objectionModalAppealId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center space-x-3 text-rose-600 mb-4">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">E'tirozingizni Kiriting</h3>
                <p className="text-xs text-slate-500">
                  Ushbu e'tiroz bevosita Bosh Kabinetga boradi
                </p>
              </div>
            </div>

            <form onSubmit={handleObjectionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nima sababdan ijro natijasidan qanoatlanmadingiz? *
                </label>
                <textarea
                  rows={4}
                  value={objectionReason}
                  onChange={(e) => setObjectionReason(e.target.value)}
                  placeholder="Masalan: Muammo to'liq hal bo'lmadi, amalda ish bajarilmagan yoki kamchiliklar bor..."
                  required
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setObjectionModalAppealId(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>E'tirozni Yuborish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Telegram Token Setup Guide Modal */}
      {showTokenGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-blue-600 mb-4">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Real Telegram Botni Ulash Yyo'riqnomasi</h3>
                <p className="text-xs text-slate-500">
                  Real Telegram Bot Tokenni sozlash va avtomatlashtirish
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 mb-1">1-qadam: BotFather orqali Bot yaratish</p>
                <p className="text-slate-600">
                  Telegram ilovasini oching va <b>@BotFather</b> ga o'ting. <code>/newbot</code> buyrug'ini yuboring va botingiz nomini kiriting.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 mb-1">2-qadam: Bot Tokenini nusxalash</p>
                <p className="text-slate-600">
                  @BotFather bergan maxsus API Tokenni (masalan: <code>123456789:ABCdefGhIJKlmNoPQRstUVwxyZ</code>) nusxalang.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 mb-1">3-qadam: Sozlamalarda saqlash</p>
                <p className="text-slate-600">
                  Ushbu platforma Sozlamalari (Secrets/Environment Variables) bo'limidan <b>TELEGRAM_BOT_TOKEN</b> nomli o'zgaruvchiga ushbu token qiymatini qo'ying.
                </p>
              </div>

              <div className="bg-emerald-50 text-emerald-900 p-3 rounded-xl border border-emerald-200 font-medium">
                ⚡ Token kiritilgach, ushbu server avtomatik ravishda Telegram bilan bog'lanadi va real xabarlarni qabul qila boshlaydi!
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setShowTokenGuide(false)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow"
              >
                Tushundim
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
