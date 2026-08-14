import React from 'react';

export interface Organization {
  id: string;
  name: string;
  pendingCount: number;
  completedCount: number;
}

export interface Appeal {
  id: string;
  citizenName: string;
  text: string;
  status: string;
  createdAt: string;
  aiResponse?: string;
  organizationId?: string;
}

interface BoshKabinetDashboardProps {
  organizations: Organization[];
  appeals: Appeal[];
  onRefresh: () => void;
}

export const BoshKabinetDashboard: React.FC<BoshKabinetDashboardProps> = ({
  organizations,
  appeals,
  onRefresh
}) => {
  const escalatedAppeals = appeals.filter((a) => a.status === 'ESCALATED');
  const completedAppeals = appeals.filter((a) => a.status === 'COMPLETED');
  const newAppeals = appeals.filter((a) => a.status === 'NEW');

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bosh Kabinet (Super Admin) Nazorati</h1>
          <p className="text-sm text-gray-500">Tizimdagi barcha tashkilotlar va muammoli murojaatlar monitoringi</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition flex items-center gap-2"
        >
          🔄 Yangilash
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white shadow-sm rounded-lg border-l-4 border-blue-500">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Jami Murojaatlar</p>
          <p className="text-3xl font-extrabold text-gray-800 mt-1">{appeals.length}</p>
        </div>

        <div className="p-5 bg-white shadow-sm rounded-lg border-l-4 border-yellow-500">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Yangi Murojaatlar</p>
          <p className="text-3xl font-extrabold text-yellow-600 mt-1">{newAppeals.length}</p>
        </div>

        <div className="p-5 bg-white shadow-sm rounded-lg border-l-4 border-red-500">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Eskalatsiya Qilingan</p>
          <p className="text-3xl font-extrabold text-red-600 mt-1">{escalatedAppeals.length}</p>
        </div>

        <div className="p-5 bg-white shadow-sm rounded-lg border-l-4 border-green-500">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hal Etilgan</p>
          <p className="text-3xl font-extrabold text-green-600 mt-1">{completedAppeals.length}</p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-5 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">🏛️ Biriktirilgan Tashkilotlar Holati</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organizations.map((org) => {
            const orgAppeals = appeals.filter((a) => a.organizationId === org.id);
            return (
              <div key={org.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">{org.name}</h3>
                  <p className="text-xs text-gray-500">ID: #{org.id}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-700">Murojaatlar: {orgAppeals.length} ta</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-5 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
            🚨 Nazoratga Olingan Muammoli Murojaatlar
          </h2>
          <span className="text-xs font-bold bg-red-100 text-red-800 px-2.5 py-1 rounded-full">
            {escalatedAppeals.length} ta e'tiroz
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 text-sm">
                <th className="p-3">ID</th>
                <th className="p-3">Fuqaro</th>
                <th className="p-3">Murojaat Matni</th>
                <th className="p-3">Sana/Vaqt</th>
                <th className="p-3">Holati</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {escalatedAppeals.map((appeal) => (
                <tr key={appeal.id} className="hover:bg-red-50/50 transition">
                  <td className="p-3 font-mono text-sm font-semibold text-gray-700">#{appeal.id}</td>
                  <td className="p-3 font-medium text-gray-800">{appeal.citizenName}</td>
                  <td className="p-3 text-sm text-gray-600 max-w-md truncate">{appeal.text}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {new Date(appeal.createdAt).toLocaleString('uz-UZ')}
                  </td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 text-xs rounded-full bg-red-100 text-red-800 font-bold border border-red-200">
                      ESCALATED
                    </span>
                  </td>
                </tr>
              ))}

              {escalatedAppeals.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <p className="text-base font-medium">Hozirda muammoli yoki e'tiroz bildirilgan murojaatlar mavjud emas.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BoshKabinetDashboard;