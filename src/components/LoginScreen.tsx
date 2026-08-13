import React, { useState } from 'react';
import { Lock, Key, ShieldCheck, Building2, Eye, EyeOff, AlertCircle, ArrowRight, Bot } from 'lucide-react';
import { Organization } from '../types';

interface LoginScreenProps {
  organizations: Organization[];
  onLoginSuccess: (role: 'tashkilot' | 'bosh_kabinet', organization?: Organization) => void;
  botStatus: { isActive: boolean; botUsername?: string };
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  organizations,
  onLoginSuccess,
  botStatus,
}) => {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password.trim()) {
      setErrorMsg('Iltimos, maxsus parolni kiriting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.role === 'bosh_kabinet') {
          onLoginSuccess('bosh_kabinet');
        } else if (data.role === 'tashkilot' && data.organization) {
          onLoginSuccess('tashkilot', data.organization);
        }
      } else {
        setErrorMsg(data.message || 'Kiritilgan maxsus parol noto\'g\'ri!');
      }
    } catch (err) {
      setErrorMsg('Server bilan bog\'lanishda xatolik yuz berdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (pwd: string) => {
    setPassword(pwd);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Background Subtle Gradient Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 animate-fade-in">
        
        {/* Header */}
        <div className="p-8 text-center border-b border-slate-800 bg-gradient-to-b from-slate-800/60 to-slate-900">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400 mb-4 shadow-lg shadow-indigo-600/10">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Tashkilot va Boshqaruv Portali
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dashbordga kirish uchun maxsus parolingizni kiriting
          </p>

          {/* Bot Status Banner */}
          <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-[11px]">
                {botStatus.isActive && botStatus.botUsername 
                  ? `@${botStatus.botUsername}` 
                  : 'Real Telegram Bot'}
              </span>
            </div>
            <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold rounded-full">
              🟢 Ishchi Holatda
            </span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Maxsus Parolni Kiriting *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Maxsus parolingizni kiriting..."
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-xl pl-4 pr-11 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Tekshirilmoqda...' : 'Dashbordga Kirish'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>

      <footer className="mt-6 text-center text-[11px] text-slate-600">
        Fuqarolar murojaatlari real Telegram bot orqali qabul qilinadi
      </footer>

    </div>
  );
};
