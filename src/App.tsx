import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { RoleSelector } from './components/RoleSelector';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { TashkilotDashboard } from './components/TashkilotDashboard';
import { LoginModal } from './components/LoginModal';
import { TelegramSettingsModal } from './components/TelegramSettingsModal';
import { Organization, Appeal, UserRole } from './types';
import { INITIAL_ORGANIZATIONS, INITIAL_APPEALS } from './data/initialData';
import {
  Sparkles,
  Bot,
  BrainCircuit,
  RotateCcw,
  FileSpreadsheet,
  Radio,
} from 'lucide-react';

export function App() {
  const [organizations, setOrganizations] = useState<Organization[]>(INITIAL_ORGANIZATIONS);
  const [appeals, setAppeals] = useState<Appeal[]>(INITIAL_APPEALS);
  const [activeRole, setActiveRole] = useState<UserRole>('SUPER_ADMIN');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLiveSync, setIsLiveSync] = useState(true);

  // Fetch initial data from server
  const fetchData = async () => {
    try {
      const [orgsRes, appealsRes] = await Promise.all([
        fetch('/api/organizations'),
        fetch('/api/appeals'),
      ]).catch(() => [null, null]);

      if (orgsRes && orgsRes.ok) {
        const contentType = orgsRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const orgsData = await orgsRes.json();
          if (Array.isArray(orgsData)) setOrganizations(orgsData);
        }
      }

      if (appealsRes && appealsRes.ok) {
        const contentType = appealsRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const appealsData = await appealsRes.json();
          if (Array.isArray(appealsData)) setAppeals(appealsData);
        }
      }
    } catch (err) {
      // Silently fall back to existing local state on network glitches
      console.warn('Data sync notice:', err);
    }
  };

  useEffect(() => {
    fetchData();
    // Polling every 5 seconds for real-time updates from Telegram Bot
    const interval = setInterval(() => {
      if (isLiveSync) {
        fetchData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isLiveSync]);

  // Super Admin: Add new appeal
  const handleAddAppeal = async (newAppealData: Omit<Appeal, 'id' | 'appealNumber' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAppealData),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const savedAppeal = await res.json();
        if (savedAppeal && savedAppeal.id) {
          setAppeals((prev) => [savedAppeal, ...prev]);
        }
        fetchData(); // Sync organizations stats
      }
    } catch (err) {
      console.error('Failed to add appeal:', err);
    }
  };

  // Update Appeal (Tashkilot or Super Admin)
  const handleUpdateAppeal = async (updatedAppeal: Appeal) => {
    try {
      const res = await fetch(`/api/appeals/${updatedAppeal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAppeal),
      });
      if (res.ok) {
        setAppeals((prev) =>
          prev.map((a) => (a.id === updatedAppeal.id ? updatedAppeal : a))
        );
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update appeal:', err);
    }
  };

  // Super Admin: Register new organization
  const handleAddOrganization = async (newOrgData: Omit<Organization, 'id' | 'totalAppeals' | 'completedAppeals' | 'inProgressAppeals' | 'expiredAppeals' | 'rejectedAuthorityAppeals'>) => {
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrgData),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const savedOrg = await res.json();
        if (savedOrg && savedOrg.id) {
          setOrganizations((prev) => [...prev, savedOrg]);
        }
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add organization:', err);
    }
  };

  // Super Admin: Update organization password/info
  const handleUpdateOrganization = async (updatedOrg: Organization) => {
    try {
      const res = await fetch(`/api/organizations/${updatedOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrg),
      });
      if (res.ok) {
        setOrganizations((prev) =>
          prev.map((o) => (o.id === updatedOrg.id ? updatedOrg : o))
        );
      }
    } catch (err) {
      console.error('Failed to update organization:', err);
    }
  };

  // Super Admin: Delete organization
  const handleDeleteOrganization = async (id: string) => {
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setOrganizations((prev) => prev.filter((o) => o.id !== id));
        setAppeals((prev) => prev.filter((a) => a.organizationId !== id));
      }
    } catch (err) {
      console.error('Failed to delete organization:', err);
    }
  };

  // AI Smart Summary & Analytics
  const handleAnalyzeWithAI = async (prompt: string) => {
    setIsAnalyzing(true);
    setAiAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/analyze-appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          setAiAnalysisResult(data.analysis);
        } else {
          setAiAnalysisResult(`Xatolik: ${data.error || 'Tahlil qilib bo‘lmadi'}`);
        }
      } else {
        const text = await res.text();
        setAiAnalysisResult(`Xatolik: ${text || 'Tahlil qilib bo‘lmadi'}`);
      }
    } catch (err: any) {
      setAiAnalysisResult(`Tizim xatosi: ${err.message || err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send Telegram Notification Helper
  const handleSendTelegramNotification = async (appealId: string, messageText: string) => {
    try {
      await fetch('/api/telegram/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appealId, message: messageText }),
      });
    } catch (e) {
      console.error('Failed to send telegram notification:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased">
      {/* Top Header */}
      <Header
        onOpenTelegramSettings={() => setIsTelegramModalOpen(true)}
        onOpenAiAnalytics={() => setIsAiModalOpen(true)}
        isLiveSync={isLiveSync}
        onToggleLiveSync={() => setIsLiveSync((prev) => !prev)}
      />

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Stats Bar */}
        <StatsOverview organizations={organizations} appeals={appeals} />

        {/* Role Navigation Bar */}
        <RoleSelector
          organizations={organizations}
          activeRole={activeRole}
          onSelectRole={setActiveRole}
        />

        {/* Role View */}
        <div className="mt-6">
          {activeRole === 'SUPER_ADMIN' ? (
            <SuperAdminDashboard
              organizations={organizations}
              appeals={appeals}
              onAddAppeal={handleAddAppeal}
              onUpdateAppeal={handleUpdateAppeal}
              onAddOrganization={handleAddOrganization}
              onUpdateOrganization={handleUpdateOrganization}
              onDeleteOrganization={handleDeleteOrganization}
              onSendTelegramNotification={handleSendTelegramNotification}
            />
          ) : (
            <TashkilotDashboard
              organization={organizations.find((o) => o.id === activeRole)!}
              appeals={appeals.filter((a) => a.organizationId === activeRole)}
              onUpdateAppeal={handleUpdateAppeal}
              onSendTelegramNotification={handleSendTelegramNotification}
            />
          )}
        </div>
      </main>

      {/* Telegram Settings Modal */}
      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      {/* AI Analytics Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-linear-to-r from-purple-600 to-indigo-700 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                <h3 className="text-lg font-bold">AI Tahlil va Maslahatchi (Gemini 2.5)</h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Tuman sektoridagi barcha murojaatlar, tashkilotlar faolligi va e'tirozlar asosida sun'iy intellekt orqali chuqur tahlil oling.
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Masalan: Eng ko'p muammo bo'layotgan 3 ta soha va sabablari..."
                  value={analysisPrompt}
                  onChange={(e) => setAnalysisPrompt(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden"
                />
                <button
                  onClick={() => handleAnalyzeWithAI(analysisPrompt)}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isAnalyzing ? 'Tahlil qilinmoqda...' : 'Tahlil qilish'}
                </button>
              </div>

              {aiAnalysisResult && (
                <div className="mt-4 max-h-80 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm text-slate-800 border border-slate-200 whitespace-pre-line leading-relaxed">
                  {aiAnalysisResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}