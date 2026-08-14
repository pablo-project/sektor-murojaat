import React, { useState } from 'react';
import { ShieldCheck, Building2, AlertTriangle, CheckCircle2, Clock, ThumbsDown, Search, Plus, Eye, User, Phone, ArrowRight, ShieldAlert, Sparkles, Filter, ChevronRight } from 'lucide-react';
import { Organization, Appeal, SystemStats } from '../types';

interface BoshKabinetDashboardProps {
  organizations: Organization[];
  appeals: Appeal[];
  onAddOrganization: (orgData: { name: string; code: string; category: string; phone: string; leader: string; password?: string }) => Promise<void>;
  isLoading: boolean;
}

export const BoshKabinetDashboard: React.FC<BoshKabinetDashboardProps> = ({
  organizations,
  appeals,
  onAddOrganization,
  isLoading,
}) => {
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'organizations' | 'appeals' | 'objections' | 'overdue'>('organizations');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);

  // New Organization Modal
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgCategory, setNewOrgCategory] = useState('Davlat Boshqaruvi');
  const [newOrgPhone, setNewOrgPhone] = useState('+998 71 200-');
  const [newOrgLeader, setNewOrgLeader] = useState('');
  const [newOrgPassword, setNewOrgPassword] = useState('');

  const handleOpenAddOrgModal = () => {
    setNewOrgPassword(`pablo${2204 + organizations.length}`);
    setShowAddOrgModal(true);
  };

  // SLA Helper
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
      text: `⏱️ ${hours}soat ${minutes}daq`,
      className: hours < 4 ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200 font-bold',
    };
  };

  const isAppealOverdue = (a: Appeal) => {
    if (a.status === 'hal_etildi') return false;
    const deadlineMs = a.deadlineAt
      ? new Date(a.deadlineAt).getTime()
      : new Date(a.createdAt).getTime() + 24 * 60 * 60 * 1000;
    return Date.now() > deadlineMs;
  };

  // Overall system metrics
  const totalAppealsCount = appeals.length;
  const resolvedCount = appeals.filter((a) => a.status === 'hal_etildi').length;
  const inProgressCount = appeals.filter((a) => a.status === 'jarayonda' || a.status === 'yangi').length;
  const objectionsCount = appeals.filter((a) => a.feedback === 'etirozli').length;
  const overdueAppeals = appeals.filter(isAppealOverdue);
  const overdueCount = overdueAppeals.length;

  const satisfactionRate =
    resolvedCount > 0
      ? Math.round((appeals.filter((a) => a.feedback === 'roziman').length / (resolvedCount || 1)) * 100)
      : 100;

  // Filtered appeals list for the explorer view
  const filteredAppeals = appeals.filter((a) => {
    if (selectedOrgFilter && a.organizationId !== selectedOrgFilter) return false;
    if (activeTab === 'objections' && a.feedback !== 'etirozli') return false;
    if (activeTab === 'overdue' && !isAppealOverdue(a)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.appealNumber.toLowerCase().includes(q) ||
        a.organizationName.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.content.toLowerCase().includes(q) ||
        (a.address && a.address.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleOrgClick = (orgId: string) => {
    setSelectedOrgFilter(orgId);
    setActiveTab('appeals');
  };

  const handleAddOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgCode) return;

    await onAddOrganization({
      name: newOrgName,
      code: newOrgCode,
      category: newOrgCategory,
      phone: newOrgPhone,
      leader: newOrgLeader,
      password: newOrgPassword || `${newOrgCode.toLowerCase().replace(/[^a-z0-9]/g, '')}123`,
    });

    setShowAddOrgModal(false);
    setNewOrgName('');
    setNewOrgCode('');
    setNewOrgPassword('');
    alert('Yangi tashkilot va maxsus parol muvaffaqiyatli qo\'shildi!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-emerald-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-slate-100">Bosh Kabinet (Natsional Nazorat)</h2>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-0.5 rounded-full font-bold border border-emerald-500/30">

              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Barcha tuman va shahar tashkilotlarining murojaatlar ijrosi, bajarilgan ishlar soni va e'tirozli holatlar monitoringi.
            </p>
          </div>
        </div>

        <button
          id="btn-boshkabinet-add-org"
          onClick={handleOpenAddOrgModal}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs py-3 px-5 rounded-2xl shadow-lg flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>+ Yangi Tashkilot Qo'shish</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Jami Tashkilotlar</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-slate-900">{organizations.length} ta</span>
            <Building2 className="w-5 h-5 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Jami Murojaatlar</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-slate-900">{totalAppealsCount} ta</span>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-1 bg-emerald-50/30">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Bajarilgan (Hal Etilgan)</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-emerald-700">{resolvedCount} ta</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('objections')}
          className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm space-y-1 bg-rose-50/40 cursor-pointer hover:border-rose-400 transition-all"
        >
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">E'tirozli Murojaatlar</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-rose-700">{objectionsCount} ta</span>
            <ThumbsDown className="w-5 h-5 text-rose-600 animate-bounce" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Aholi Qanoatlanishi</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-emerald-600">{satisfactionRate}%</span>
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
        </div>
      </div>

      {/* 24-Hour Overdue Alert Banner for Bosh Kabinet */}
      {overdueCount > 0 && (
        <div className="bg-rose-500/10 border-2 border-rose-500/40 p-4 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 shadow-lg animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl flex-shrink-0 shadow-md">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-800">
                🚨 BOSH KABINET OGOHLANTIRISHI: {overdueCount} TA MUROJAAT 24 SOAT ICHIDA BAJARILMADI!
              </h4>
              <p className="text-xs text-rose-700 font-medium">
                Tegishli mas'ul tashkilotlar belgilangan 1 kunlik (24 soat) muddatda murojaatni bajarib ulgurmadi.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('overdue');
              setSelectedOrgFilter(null);
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition-colors whitespace-nowrap self-stretch sm:self-auto text-center"
          >
            Murojaatlarni O'rganish
          </button>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => {
              setActiveTab('organizations');
              setSelectedOrgFilter(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'organizations'
                ? 'bg-slate-900 text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🏢 Tashkilotlar
          </button>

          <button
            onClick={() => setActiveTab('appeals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'appeals'
                ? 'bg-slate-900 text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📋 Barcha Murojaatlar
          </button>

          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'overdue'
                ? 'bg-amber-600 text-white shadow'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>🚨 24 Soat O'tganlar ({overdueCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('objections')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'objections'
                ? 'bg-rose-600 text-white shadow'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>🔴 E'tirozlar ({objectionsCount})</span>
          </button>
        </div>

        {selectedOrgFilter && (
          <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs px-3 py-1.5 rounded-xl font-bold">
            <span>Filter: {organizations.find((o) => o.id === selectedOrgFilter)?.name}</span>
            <button
              onClick={() => setSelectedOrgFilter(null)}
              className="text-indigo-600 hover:text-indigo-900 font-bold ml-1"
            >
              ✕
            </button>
          </div>
        )}

      </div>

      {/* VIEW 1: Organizations List Table with Clickable Counts */}
      {activeTab === 'organizations' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Toshkent Tumani Tashkilotlari Boshqaruvi</h3>
              <p className="text-xs text-slate-500">
                Tashkilotlarning murojaat bajarish ko'rsatkichlari. Sonlar ustiga bossangiz, batafsil murojaatlar ochiladi.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-4">Kodi</th>
                  <th className="p-4">Tashkilot Nomi</th>
                  <th className="p-4">Soha / Kategoriya</th>
                  <th className="p-4 text-center">Jami</th>
                  <th className="p-4 text-center">Jarayonda</th>
                  <th className="p-4 text-center">Bajarilgan (Hal Etilgan)</th>
                  <th className="p-4 text-center">E'tirozlar</th>
                  <th className="p-4 text-right">Murojaatlarga o'tish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {organizations.map((org) => (
                  <tr
                    key={org.id}
                    onClick={() => handleOrgClick(org.id)}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {org.code}
                      </span>
                    </td>

                    <td className="p-4 font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
                      {org.name}
                    </td>

                    <td className="p-4 text-slate-600">{org.category}</td>

                    <td className="p-4 text-center font-bold text-slate-800">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-full">{org.totalAppeals}</span>
                    </td>

                    <td className="p-4 text-center font-bold text-blue-600">
                      <span className="bg-blue-50 px-2.5 py-1 rounded-full">{org.inProgressAppeals}</span>
                    </td>

                    {/* Clickable Resolved Count Badge */}
                    <td className="p-4 text-center font-bold">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrgClick(org.id);
                        }}
                        className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-3 py-1.5 rounded-xl font-bold transition-all shadow-sm border border-emerald-200 flex items-center justify-center space-x-1 mx-auto"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{org.resolvedAppeals} ta bajargan</span>
                      </button>
                    </td>

                    <td className="p-4 text-center font-bold">
                      {org.objectionAppeals > 0 ? (
                        <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full font-bold animate-pulse">
                          ⚠️ {org.objectionAppeals} ta
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">0</span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <button className="px-3 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-colors flex items-center space-x-1 ml-auto">
                        <span>Batafsil</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2 & 3: Appeals List or Objections or Overdue list */}
      {(activeTab === 'appeals' || activeTab === 'objections' || activeTab === 'overdue') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {activeTab === 'objections' 
                  ? "🔴 E'tirozli Murojaatlar (Nazoratda)" 
                  : activeTab === 'overdue' 
                  ? "🚨 24 Soatlik Muddatda Bajarilmagan Murojaatlar" 
                  : "📋 Murojaatlar Explorer"}
              </h3>
              <p className="text-xs text-slate-500">
                Ism va familiya hamda manzil bo'yicha qidirish, muddatlarni va ijro holatini nazorat qilish.
              </p>
            </div>

            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ism, manzil yoki qidiruv..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3.5">№</th>
                  <th className="p-3.5">Fuqaro va Manzil</th>
                  <th className="p-3.5">Tashkilot</th>
                  <th className="p-3.5 max-w-xs">Murojaat Matni</th>
                  <th className="p-3.5">24 Soatlik Muddat</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Batafsil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAppeals.map((appeal) => {
                  const sla = getSlaInfo(appeal.createdAt, appeal.deadlineAt, appeal.status);
                  return (
                    <tr
                      key={appeal.id}
                      onClick={() => setSelectedAppeal(appeal)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {appeal.appealNumber}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{appeal.fullName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {appeal.phone}
                        </div>
                        {appeal.address && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                            📍 {appeal.address}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-semibold text-indigo-700">{appeal.organizationName}</td>

                      <td className="p-3.5 max-w-xs truncate text-slate-700">{appeal.content}</td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] border ${sla.className}`}>
                          {sla.text}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {appeal.status === 'hal_etildi' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            Hal Etilgan
                          </span>
                        )}
                        {appeal.status === 'jarayonda' && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                            Jarayonda
                          </span>
                        )}
                        {appeal.status === 'yangi' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                            Yangi
                          </span>
                        )}
                        {appeal.status === 'vakolatda_emas' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                            Vakolatsiz
                          </span>
                        )}
                        {appeal.feedback === 'etirozli' && (
                          <span className="ml-1 bg-rose-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded">
                            E'tiroz Bor
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedAppeal(appeal)}
                          className="px-3 py-1 bg-slate-900 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg transition-colors"
                        >
                          O'rganish
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Executive Appeal View Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-100 text-emerald-900 font-mono font-bold text-xs px-2.5 py-1 rounded-md">
                  {selectedAppeal.appealNumber}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {selectedAppeal.organizationName}
                </span>
              </div>

              <button
                onClick={() => setSelectedAppeal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Citizen Request */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-xs text-slate-600 font-semibold flex flex-wrap items-center justify-between gap-2">
                <div>Fuqaro: <strong className="text-slate-900">{selectedAppeal.fullName}</strong> ({selectedAppeal.phone})</div>
                <div>Sana: {new Date(selectedAppeal.createdAt).toLocaleString('uz-UZ')}</div>
              </div>
              <div className="text-xs text-slate-700 font-medium">
                Manzil: <strong className="text-slate-900">{selectedAppeal.address || 'Kiritilmagan'}</strong>
              </div>
              <div className="flex items-center space-x-2 pt-1 text-xs">
                <span className="font-semibold text-slate-600">24 Soatlik Muddat holati:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs border font-bold ${getSlaInfo(selectedAppeal.createdAt, selectedAppeal.deadlineAt, selectedAppeal.status).className}`}>
                  {getSlaInfo(selectedAppeal.createdAt, selectedAppeal.deadlineAt, selectedAppeal.status).text}
                </span>
              </div>
              <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed font-medium mt-2">
                {selectedAppeal.content}
              </p>
            </div>

            {/* Tashkilot Resolution */}
            {selectedAppeal.resolutionText ? (
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-2">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                  Tashkilot Ijro Hulosasi ({selectedAppeal.assignedOperator || 'Mas\'ul'})
                </span>
                <p className="text-xs text-slate-900 bg-white p-3 rounded-xl border border-emerald-100">
                  {selectedAppeal.resolutionText}
                </p>

                {selectedAppeal.resolutionPhotoUrl && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">
                      Bajarilgan ish foto-isboti:
                    </span>
                    <img
                      src={selectedAppeal.resolutionPhotoUrl}
                      alt="Resolution Proof"
                      className="w-full max-h-48 object-cover rounded-xl border border-slate-200"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 font-semibold">
                ⏳ Tashkilot hali ishni yakunlamagan (Jarayonda).
              </div>
            )}

            {/* Citizen Objection Detail */}
            {selectedAppeal.feedback === 'etirozli' && (
              <div className="bg-rose-100 border border-rose-300 p-4 rounded-2xl space-y-2 text-rose-950">
                <h4 className="text-xs font-extrabold flex items-center space-x-1.5 text-rose-900">
                  <ShieldAlert className="w-4 h-4 text-rose-700" />
                  <span>FUQARO E'TIROZI (BOSH KABINET NAZORATIDA):</span>
                </h4>
                <p className="text-xs bg-white p-3 rounded-xl border border-rose-200 font-semibold text-slate-900">
                  "{selectedAppeal.objectionText}"
                </p>
                <div className="text-[10px] text-rose-800 font-bold">
                  Bosh Kabinet ushbu e'tiroz bo'yicha tashkilot rahbaridan xizmat tekshiruvi so'rashi mumkin.
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAppeal(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Yopish
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add New Organization Modal */}
      {showAddOrgModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Yangi Tashkilot Qo'shish</span>
            </h3>

            <form onSubmit={handleAddOrgSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tashkilot Nomi *</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Masalan: Tuman Gaz Ta'minoti Boshqarmasi"
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tashkilot Kodi *</label>
                  <input
                    type="text"
                    value={newOrgCode}
                    onChange={(e) => setNewOrgCode(e.target.value)}
                    placeholder="TGT-07"
                    required
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Soha / Kategoriya</label>
                  <input
                    type="text"
                    value={newOrgCategory}
                    onChange={(e) => setNewOrgCategory(e.target.value)}
                    placeholder="Kommunal"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telefon va Rahbar</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newOrgPhone}
                    onChange={(e) => setNewOrgPhone(e.target.value)}
                    placeholder="+998 71..."
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={newOrgLeader}
                    onChange={(e) => setNewOrgLeader(e.target.value)}
                    placeholder="Rahbar ismi..."
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Maxsus Parol (Dashbordga kirish uchun)</label>
                <input
                  type="text"
                  value={newOrgPassword}
                  onChange={(e) => setNewOrgPassword(e.target.value)}
                  placeholder="Masalan: gaz123 (kiritilmasa avto yaratiladi)"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Saqlash va Qo'shish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
