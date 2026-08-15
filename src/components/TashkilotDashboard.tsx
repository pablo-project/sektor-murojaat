import React, { useState, useRef } from 'react';
import { Building2, CheckCircle2, Clock, AlertCircle, Sparkles, Send, User, Phone, Calendar, ArrowRight, ShieldAlert, Image, Search, Filter, RefreshCw, AlertTriangle, Upload, Trash2 } from 'lucide-react';
import { Organization, Appeal } from '../types';

interface TashkilotDashboardProps {
  organization: Organization;
  appeals: Appeal[];
  onAcceptAppeal: (appealId: string, operatorName: string) => Promise<void>;
  onRejectAuthority: (appealId: string, reason: string) => Promise<void>;
  onResolveAppeal: (appealId: string, resolutionText: string, photoUrl?: string) => Promise<void>;
  onGenerateAiResponse: (content: string, orgName: string) => Promise<string>;
  isLoading: boolean;
}

export const TashkilotDashboard: React.FC<TashkilotDashboardProps> = ({
  organization,
  appeals,
  onAcceptAppeal,
  onRejectAuthority,
  onResolveAppeal,
  onGenerateAiResponse,
  isLoading,
}) => {
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'yangi' | 'jarayonda' | 'hal_etildi' | 'etirozli'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Operator modal state
  const [operatorName, setOperatorName] = useState('Inspektor B. Qodirov');
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionPhotoUrl, setResolutionPhotoUrl] = useState('https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80');
  const [photoFileName, setPhotoFileName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter appeals for this organization
  const orgAppeals = appeals.filter((a) => a.organizationId === organization.id);

  const filteredAppeals = orgAppeals.filter((a) => {
    if (activeFilter === 'yangi' && a.status !== 'yangi') return false;
    if (activeFilter === 'jarayonda' && a.status !== 'jarayonda') return false;
    if (activeFilter === 'hal_etildi' && a.status !== 'hal_etildi') return false;
    if (activeFilter === 'etirozli' && a.feedback !== 'etirozli') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.appealNumber.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.content.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleOpenDetail = (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setResolutionText(appeal.resolutionText || '');
    setResolutionPhotoUrl(appeal.resolutionPhotoUrl || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80');
    setPhotoFileName('');
    setShowRejectForm(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Rasm hajmi 10MB dan oshmasligi kerak');
      return;
    }

    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setResolutionPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setResolutionPhotoUrl('');
    setPhotoFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAccept = async () => {
    if (!selectedAppeal) return;
    await onAcceptAppeal(selectedAppeal.id, operatorName);
    setSelectedAppeal((prev) => (prev ? { ...prev, status: 'jarayonda', assignedOperator: operatorName } : null));
  };

  const handleRejectAuthorityAction = async () => {
    if (!selectedAppeal) return;
    await onRejectAuthority(selectedAppeal.id, rejectReason || 'Tashkilot vakolatida emas.');
    setSelectedAppeal(null);
    setShowRejectForm(false);
  };

  const handleResolveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal || !resolutionText.trim()) return;

    await onResolveAppeal(selectedAppeal.id, resolutionText, resolutionPhotoUrl);
    setSelectedAppeal(null);
  };

  const handleGenerateAi = async () => {
    if (!selectedAppeal) return;
    setIsGeneratingAi(true);
    try {
      const text = await onGenerateAiResponse(selectedAppeal.content, organization.name);
      setResolutionText(text);
    } catch (e) {
      alert('AI javobini yaratishda xatolik yuz berdi');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Helper for 24-hour SLA calculation
  const getSlaInfo = (createdAt: string, deadlineAt?: string, status?: string) => {
    if (status === 'hal_etildi') {
      return { isOverdue: false, text: '✅ Hal etildi', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }

    const deadlineMs = deadlineAt
      ? new Date(deadlineAt).getTime()
      : new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;

    const diffMs = deadlineMs - Date.now();

    if (diffMs <= 0) {
      return { isOverdue: true, text: '🚨 24 soat o\'tdi (Bajarilmadi)', className: 'bg-rose-600 text-white font-black animate-pulse' };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isOverdue: false,
      text: `⏱️ Teskari sanoq: ${hours}soat ${minutes}daq`,
      className: hours < 4 ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold',
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Organization Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-500 to-blue-600 rounded-2xl shadow-lg text-white">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-100">{organization.name}</h2>
              <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-mono border border-indigo-500/30">
                {organization.code}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Soha: <strong className="text-slate-200">{organization.category}</strong> • Mas'ul rahbari: <strong className="text-slate-200">{organization.leader}</strong> • Tel: {organization.phone}
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-2xl text-center">
            <span className="text-xs text-slate-400 block font-medium">Jami</span>
            <span className="text-lg font-black text-slate-100">{orgAppeals.length}</span>
          </div>
          <div className="bg-blue-950/60 border border-blue-800/50 p-3 rounded-2xl text-center">
            <span className="text-xs text-blue-300 block font-medium">Jarayonda</span>
            <span className="text-lg font-black text-blue-400">
              {orgAppeals.filter((a) => a.status === 'yangi' || a.status === 'jarayonda').length}
            </span>
          </div>
          <div className="bg-emerald-950/60 border border-emerald-800/50 p-3 rounded-2xl text-center">
            <span className="text-xs text-emerald-300 block font-medium">Hal Etildi</span>
            <span className="text-lg font-black text-emerald-400">
              {orgAppeals.filter((a) => a.status === 'hal_etildi').length}
            </span>
          </div>
          <div className="bg-rose-950/60 border border-rose-800/50 p-3 rounded-2xl text-center">
            <span className="text-xs text-rose-300 block font-medium">E'tirozlar</span>
            <span className="text-lg font-black text-rose-400">
              {orgAppeals.filter((a) => a.feedback === 'etirozli').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Filter Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Barchasi ({orgAppeals.length})
          </button>
          <button
            onClick={() => setActiveFilter('yangi')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === 'yangi'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Yangi ({orgAppeals.filter((a) => a.status === 'yangi').length})
          </button>
          <button
            onClick={() => setActiveFilter('jarayonda')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === 'jarayonda'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Jarayonda ({orgAppeals.filter((a) => a.status === 'jarayonda').length})
          </button>
          <button
            onClick={() => setActiveFilter('hal_etildi')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === 'hal_etildi'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Hal Etildi ({orgAppeals.filter((a) => a.status === 'hal_etildi').length})
          </button>
          <button
            onClick={() => setActiveFilter('etirozli')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === 'etirozli'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🔴 E'tirozlar ({orgAppeals.filter((a) => a.feedback === 'etirozli').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ism, raqam yoki matn..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

      </div>

      {/* Appeals List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredAppeals.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-600">Mos murojaatlar topilmadi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Murojaat №</th>
                  <th className="p-3.5">Fuqaro (Ism Familiya)</th>
                  <th className="p-3.5">Telefon / Manzil</th>
                  <th className="p-3.5 max-w-xs">Murojaat Mazmuni</th>
                  <th className="p-3.5">24 Soatlik Muddat</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAppeals.map((appeal) => {
                  const sla = getSlaInfo(appeal.createdAt, appeal.deadlineAt, appeal.status);
                  return (
                    <tr
                      key={appeal.id}
                      onClick={() => handleOpenDetail(appeal)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {appeal.appealNumber}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{appeal.fullName}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-600">
                        <div className="font-mono font-semibold text-slate-800">{appeal.phone}</div>
                        {appeal.address && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                            📍 {appeal.address}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 max-w-xs truncate text-slate-700">
                        {appeal.content}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] border ${sla.className}`}>
                          {sla.text}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {appeal.status === 'yangi' && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                            Yangi
                          </span>
                        )}
                        {appeal.status === 'jarayonda' && (
                          <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-blue-200">
                            Jarayonda
                          </span>
                        )}
                        {appeal.status === 'hal_etildi' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                            Hal Etildi
                          </span>
                        )}
                        {appeal.status === 'vakolatda_emas' && (
                          <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-rose-200">
                            Vakolatda Emas
                          </span>
                        )}

                        {appeal.feedback === 'etirozli' && (
                          <span className="ml-1.5 bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md animate-pulse">
                            E'tiroz Bor!
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(appeal);
                          }}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1 ml-auto"
                        >
                          <span>Ko'rish</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Appeal Detail & Action Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-mono font-bold px-2.5 py-1 rounded-md">
                    {selectedAppeal.appealNumber}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Sana: {new Date(selectedAppeal.createdAt).toLocaleString('uz-UZ')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Murojaatchi: {selectedAppeal.fullName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppeal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Citizen Request Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 font-semibold">
                <div>Telefon: <strong className="text-slate-900 font-mono">{selectedAppeal.phone}</strong></div>
                <div>Tashkilot: <strong className="text-slate-900">{selectedAppeal.organizationName}</strong></div>
                <div className="col-span-1 sm:col-span-2">Manzil: <strong className="text-slate-900">{selectedAppeal.address || 'Kiritilmagan'}</strong></div>
                <div className="col-span-1 sm:col-span-2 flex items-center space-x-2 pt-1">
                  <span>24 Soatlik Muddat:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs border font-bold ${getSlaInfo(selectedAppeal.createdAt, selectedAppeal.deadlineAt, selectedAppeal.status).className}`}>
                    {getSlaInfo(selectedAppeal.createdAt, selectedAppeal.deadlineAt, selectedAppeal.status).text}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Murojaat Matni:
                </span>
                <p className="text-sm text-slate-900 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed font-medium">
                  {selectedAppeal.content}
                </p>
              </div>

              {selectedAppeal.attachmentUrl && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-600 block mb-1">Biriktirilgan fayl/rasm:</span>
                  <a
                    href={selectedAppeal.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 underline font-mono truncate block"
                  >
                    {selectedAppeal.attachmentUrl}
                  </a>
                </div>
              )}
            </div>

            {/* Status & Actions Section */}
            {selectedAppeal.status === 'yangi' && !showRejectForm && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">
                    Ushbu murojaat hali qabul qilinmadi. Ijroni o'z zimmangizga olasizmi?
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:w-1/2">
                    <input
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      placeholder="Mas'ul ijrochi ismi..."
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-1/2">
                    <button
                      id="btn-tashkilot-bajaraman"
                      onClick={handleAccept}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow flex items-center justify-center space-x-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Bajaraman</span>
                    </button>

                    <button
                      id="btn-tashkilot-vakolatmas"
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-800 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-colors"
                    >
                      Vakolatda Emas
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reject Authority Form */}
            {showRejectForm && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-rose-900 flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>"Mening vakolatimda emas" deb belgilash sababi:</span>
                </h4>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ushbu murojaat nimaga sababdan tashkilotingiz vakolatiga kirmasligini va qaysi organga taalluqli ekanligini yozing..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl bg-white"
                />
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 font-bold"
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={handleRejectAuthorityAction}
                    className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl shadow"
                  >
                    Bosh Kabinetga Yuborish
                  </button>
                </div>
              </div>
            )}

            {/* Resolution Form (When in progress or resolving) */}
            {(selectedAppeal.status === 'jarayonda' || selectedAppeal.status === 'hal_etildi') && (
              <form onSubmit={handleResolveAction} className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Tashkilot Ijro Hulosasi va Ish Natijasi *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors border border-indigo-200"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingAi ? 'AI yozmoqda...' : 'AI bilan yozish'}</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Murojaat bo'yicha amalda bajarilgan ishlar va rasmiy xulosa matnini kiriting..."
                  required
                  className="w-full text-xs p-3.5 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />

                {/* Photo Proof Upload from Computer Device */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Image className="w-4 h-4 text-indigo-600" />
                      <span>📷 Bajarilgan ish foto-isboti (Kompyuterdan yuklash):</span>
                    </label>
                    {resolutionPhotoUrl && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-xs text-rose-600 hover:text-rose-700 flex items-center space-x-1 font-semibold"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Rasmni o'chirish</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="tashkilot-photo-upload"
                  />

                  {!resolutionPhotoUrl ? (
                    <label
                      htmlFor="tashkilot-photo-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/40 rounded-2xl p-4 cursor-pointer transition-all"
                    >
                      <Upload className="w-6 h-6 text-indigo-600 mb-1" />
                      <span className="text-xs font-bold text-slate-700">Kompyuterdan foto-hisobot rasmini tanlang</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, JPEG (Maksimal 10MB)</span>
                    </label>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-48 bg-slate-100 flex items-center justify-center group">
                      <img
                        src={resolutionPhotoUrl}
                        alt="Hisobot rasmi"
                        className="w-full max-h-48 object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <label
                          htmlFor="tashkilot-photo-upload"
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow"
                        >
                          Boshqa rasm tanlash
                        </label>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow"
                        >
                          O'chirish
                        </button>
                      </div>
                      {photoFileName && (
                        <div className="absolute bottom-2 left-2 bg-white/95 px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-800 shadow border border-slate-200">
                          📷 {photoFileName}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Resolution */}
                <div className="pt-3 flex items-center justify-between border-t border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">
                    Ijrochi: <strong>{selectedAppeal.assignedOperator || operatorName}</strong>
                  </div>

                  <button
                    id="btn-tashkilot-submit-resolve"
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow flex items-center space-x-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Yuborish va Hal qilish (Botga Natija Ketadi)</span>
                  </button>
                </div>

              </form>
            )}

            {/* Display Feedback if present */}
            {selectedAppeal.feedback !== 'kutilmoqda' && (
              <div className={`p-4 rounded-2xl border ${
                selectedAppeal.feedback === 'roziman'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                  {selectedAppeal.feedback === 'roziman' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Fuqaro Bahosi: ROZIMAN (Qanoatlandi)</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>Fuqaro Bahosi: E'TIROZIM BOR!</span>
                    </>
                  )}
                </h4>

                {selectedAppeal.objectionText && (
                  <p className="text-xs bg-white/90 p-2.5 rounded-xl border border-rose-200 mt-2 font-medium">
                    E'tiroz sababi: "{selectedAppeal.objectionText}"
                  </p>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};