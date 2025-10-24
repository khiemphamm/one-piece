import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import ProxyManager from './components/ProxyManager';
import type { StatsUpdate } from './types';

type TabType = 'dashboard' | 'proxies';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState<StatsUpdate | null>(null);

  const handleStatsUpdate = (update: StatsUpdate) => {
    setStats(update);
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: '📊' },
    { id: 'proxies' as TabType, label: 'Proxy Manager', icon: '🌐' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Tool Live</h1>
          <p className="text-gray-400">YouTube Livestream Viewer Management</p>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-700">
            <nav className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 font-semibold transition-colors relative ${
                    activeTab === tab.id
                      ? 'text-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <main>
          {activeTab === 'dashboard' && <Dashboard onStatsUpdate={handleStatsUpdate} />}
          {activeTab === 'proxies' && <ProxyManager />}
        </main>

        {/* Footer Status Bar */}
        <footer className="mt-8 pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>Status: {stats?.session.isRunning ? '🟢 Active' : '⚫ Idle'}</span>
              <span>Viewers: {stats?.session.activeViewers ?? 0}</span>
              <span>Proxies: {stats?.proxies.active ?? 0}/{stats?.proxies.total ?? 0}</span>
            </div>
            <div>
              Tool Live v1.0.0
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
