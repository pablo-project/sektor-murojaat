import React, { useState, useEffect } from 'react';
import BoshKabinetDashboard, { Appeal } from './components/BoshKabinetDashboard';

export const App: React.FC = () => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [userRole, setUserRole] = useState<'admin' | 'superadmin'>('admin');

  // Murojaatlarni yuklash
  const fetchAppeals = async () => {
    try {
      // Domain o'zgarsa ham to'g'ri ishlashi uchun nisbiy URL: /api/appeals
      const res = await fetch('/api/appeals');
      if (res.ok) {
        const data = await res.json();
        setAppeals(data);
      }
    } catch (err) {
      console.error('Murojaatlarni yuklashda xatolik:', err);
    }
  };

  useEffect(() => {
    fetchAppeals();
    // Real-time: Har 3 soniyada yangi xabarlarni tekshirib turadi
    const interval = setInterval(fetchAppeals, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">Murojaatlar Boshqaruvi Tizimi</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setUserRole('admin')}
            className={`px-3 py-1 rounded text-sm transition ${
              userRole === 'admin' ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            Tashkilot Xodimi
          </button>
          <button
            onClick={() => setUserRole('superadmin')}
            className={`px-3 py-1 rounded text-sm transition ${
              userRole === 'superadmin' ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            Bosh Kabinet (Super Admin)
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4">
        {userRole === 'superadmin' ? (
          <BoshKabinetDashboard
            organizations={[
              { id: '1', name: 'Toshkent Shahar Hokimligi', pendingCount: 0, completedCount: 0 },
              { id: '2', name: 'Sogʻliqni Saqlash Vazirligi', pendingCount: 0, completedCount: 0 }
            ]}
            appeals={appeals}
            onRefresh={fetchAppeals}
          />
        ) : (
          <div className="p-6 bg-white shadow rounded-lg space-y-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800">Kelib Tushgan Murojaatlar Dashbordi</h2>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                Jonli yangilanish (3s)
              </span>
            </div>

            <div className="space-y-3">
              {appeals.map((item) => (
                <div key={item.id} className="p-4 border rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                        #{item.id}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleTimeString('uz-UZ')}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800">{item.citizenName}</h3>
                    <p className="text-sm text-gray-600">{item.text}</p>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        item.status === 'NEW'
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          : item.status === 'ESCALATED'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-green-100 text-green-800 border border-green-300'
                      }`}
                    >
                      {item.status === 'NEW' ? 'Yangi' : item.status === 'ESCALATED' ? 'Eskalatsiya' : 'Bajarildi'}
                    </span>
                  </div>
                </div>
              ))}

              {appeals.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg font-medium">Hozircha hech qanday murojaat yo'q</p>
                  <p className="text-sm">Telegram botingizga biron matn yuborib tekshirib ko'ring, shu yerda zudlik bilan paydo bo'ladi!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;