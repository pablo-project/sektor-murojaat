import React, { useState, useEffect } from 'react';
import { TashkilotDashboard } from './components/TashkilotDashboard';
import { BoshKabinetDashboard } from './components/BoshKabinetDashboard';
import { LoginScreen } from './components/LoginScreen';
import { Organization, Appeal } from './types';
import { Building2, ShieldCheck, RefreshCw, LogOut, Bot } from 'lucide-react';

export default function App() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [botStatus, setBotStatus] = useState<{ isActive: boolean; botUsername?: string }>({ isActive: false });

  // Authentication State
  const [userRole, setUserRole] = useState<'guest' | 'tashkilot' | 'bosh_kabinet'>('guest');
  const [authenticatedOrg, setAuthenticatedOrg] = useState<Organization | null>(null);

  // Fetch data from backend API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [orgsRes, appealsRes, botRes] = await Promise.all([
        fetch('/api/organizations'),
        fetch('/api/appeals'),
        fetch('/api/telegram/status'),
      ]);

      if (orgsRes.ok && appealsRes.ok) {
        const orgsData: Organization[] = await orgsRes.json();
        const appealsData: Appeal[] = await appealsRes.json();

        setOrganizations(orgsData);
        setAppeals(appealsData);

        // Keep authenticatedOrg updated if stats changed
        if (authenticatedOrg) {
          const updated = orgsData.find((o) => o.id === authenticatedOrg.id);
          if (updated) setAuthenticatedOrg(updated);
        }
      }

      if (botRes.ok) {
        const bData = await botRes.json();
        setBotStatus(bData);
      }
    } catch (err) {
      console.error('Data fetching error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll data every 5 seconds to simulate real-time updates across windows/tabs
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (role: 'tashkilot' | 'bosh_kabinet', organization?: Organization) => {
    if (role === 'bosh_kabinet') {
      setUserRole('bosh_kabinet');
      setAuthenticatedOrg(null);
    } else if (role === 'tashkilot' && organization) {
      setUserRole('tashkilot');
      setAuthenticatedOrg(organization);
    }
  };

  const handleLogout = () => {
    setUserRole('guest');
    setAuthenticatedOrg(null);
  };

  // 1. Organization accepts appeal ("Bajaraman")
  const handleAcceptAppeal = async (appealId: string, operatorName: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/appeals/${appealId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error accepting appeal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Organization rejects authority ("Mening vakolatimda emas")
  const handleRejectAuthority = async (appealId: string, reason: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/appeals/${appealId}/reject-authority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error rejecting authority:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Organization resolves appeal (Hulosa + Rasm)
  const handleResolveAppeal = async (appealId: string, resolutionText: string, photoUrl?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/appeals/${appealId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionText, resolutionPhotoUrl: photoUrl }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error resolving appeal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Gemini AI draft response generator
  const handleGenerateAiResponse = async (appealContent: string, orgName: string): Promise<string> => {
    try {
      const res = await fetch('/api/gemini/suggest-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appealContent, organizationName: orgName }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.suggestedResponse;
      }
    } catch (err) {
      console.error('AI draft generation failed:', err);
    }
    return `Hurmatli fuqaro, sizning murojaatingiz ${orgName} mas'ul xodimlari tomonidan ko'rib chiqildi hamda belgilangan tartibda ijobiy hal etildi.`;
  };

  // 5. Bosh Kabinet adds new Organization
  const handleAddOrganization = async (orgData: {
    name: string;
    code: string;
    category: string;
    phone: string;
    leader: string;
    password?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgData),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error adding organization:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Render Login Portal if not authenticated
  if (userRole === 'guest') {
    return (
      <LoginScreen
        organizations={organizations}
        onLoginSuccess={handleLoginSuccess}
        botStatus={botStatus}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col">
      
      {/* Clean Authenticated Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          
          {/* Active Context Title */}
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl text-white shadow-md ${
              userRole === 'tashkilot' ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-emerald-600 shadow-emerald-600/30'
            }`}>
              {userRole === 'tashkilot' ? <Building2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-100 tracking-tight flex items-center space-x-2">
                <span>{userRole === 'tashkilot' ? authenticatedOrg?.name : '👑 Bosh Kabinet (Super Admin)'}</span>
              </h1>
              <p className="text-xs text-slate-400">
                {userRole === 'tashkilot' ? 'Murojaatlarni ijro etish va xulosa yuborish paneli' : 'Sektorlar va Tashkilotlar umumiy nazorat portali'}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-3">
            {botStatus.botUsername && (
              <a
                href={`https://t.me/${botStatus.botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>@{botStatus.botUsername}</span>
              </a>
            )}

            <button
              onClick={fetchData}
              disabled={isLoading}
              title="Ma'lumotlarni yangilash"
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Chiqish</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1">
        {userRole === 'tashkilot' && authenticatedOrg && (
          <TashkilotDashboard
            organization={authenticatedOrg}
            appeals={appeals}
            onAcceptAppeal={handleAcceptAppeal}
            onRejectAuthority={handleRejectAuthority}
            onResolveAppeal={handleResolveAppeal}
            onGenerateAiResponse={handleGenerateAiResponse}
            isLoading={isLoading}
          />
        )}

        {userRole === 'bosh_kabinet' && (
          <BoshKabinetDashboard
            organizations={organizations}
            appeals={appeals}
            onAddOrganization={handleAddOrganization}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-4 text-center">
        <p>
          © 2026 Murojaatlar va Tashkilotlar Boshqaruvi Axborot Tizimi • Xavfsiz Maxsus Parol va Telegram Bot Integratsiyasi
        </p>
      </footer>
    </div>
  );
}
