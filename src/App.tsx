import { useState } from 'react';
import Dashboard from './components/Dashboard';
import ProxyManager from './components/ProxyManager';
import UpdateCenter from './components/UpdateCenter';
import UpdateNotification from './components/UpdateNotification';
import Settings from './components/Settings';
import LogsPanel from './components/LogsPanel';
import type { StatsUpdate } from './types';
import { ToastContainer, Toast } from './components/Toast';

type TabType = 'dashboard' | 'proxies' | 'settings' | 'logs' | 'updates';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState<StatsUpdate | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const handleStatsUpdate = (update: StatsUpdate) => {
    setStats(update);
  };

  const handleInstallUpdate = () => {
    if (window.electron) {
      window.electron.installUpdate();
    }
  };

  // Toast helpers
  const addToast = (message: string, type: Toast['type']) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: '📊' },
    { id: 'proxies' as TabType, label: 'Proxies', icon: '🌐' },
    { id: 'logs' as TabType, label: 'Logs', icon: '📋' },
    { id: 'settings' as TabType, label: 'Settings', icon: '⚙️' },
    { id: 'updates' as TabType, label: 'Updates', icon: '⬇️' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 text-gray-900">
      {/* Header với Glass Morphism */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-xl">📺</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Cùng ra đại hải trình
                </h1>
                <p className="text-xs text-gray-600">Làm top 1 streamer</p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200">
                  <div
                    className={`w-2 h-2 rounded-full ${stats?.session.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
                  ></div>
                  <span className="text-gray-700 font-medium">
                    {stats?.session.isRunning ? 'Active' : 'Idle'}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-gray-600">Viewers: </span>
                  <span className="font-semibold text-blue-600">
                    {stats?.session.activeViewers ?? 0}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200">
                  <span className="text-gray-600">Proxies: </span>
                  <span className="font-semibold text-purple-600">
                    {stats?.proxies.active ?? 0}/{stats?.proxies.total ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1 mt-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && <Dashboard onStatsUpdate={handleStatsUpdate} />}
          {activeTab === 'proxies' && <ProxyManager />}
          {activeTab === 'logs' && <LogsPanel />}
          {activeTab === 'settings' && <Settings onToast={addToast} />}
          {activeTab === 'updates' && <UpdateCenter />}
        </div>
      </main>

      {/* Update Notification */}
      <UpdateNotification onInstall={handleInstallUpdate} />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Footer */}
      <footer className="mt-auto py-4 text-center text-xs text-gray-500 border-t border-gray-200">
        Made by Khiem Pham ❤️
      </footer>
    </div>
  );
}

export default App;
