import React, { useState, useEffect } from 'react';
import type { StatsUpdate, Proxy } from '../types';
import { ToastContainer, Toast } from './Toast';
import { RealtimeChart } from './RealtimeChart';
import { ProxyTable } from './ProxyTable';

interface DashboardProps {
  onStatsUpdate?: (stats: StatsUpdate) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onStatsUpdate }) => {
  // Form state
  const [livestreamUrl, setLivestreamUrl] = useState('');
  const [viewerCount, setViewerCount] = useState(10);
  const [platform, setPlatform] = useState<'youtube' | 'tiktok'>('youtube');
  const [isRunning, setIsRunning] = useState(false);

  // Stats state
  const [stats, setStats] = useState<StatsUpdate['session'] | null>(null);
  const [proxyStats, setProxyStats] = useState<StatsUpdate['proxies'] | null>(null);
  const [proxyList, setProxyList] = useState<Proxy[]>([]);
  
  // Chart history state (60 data points = 60 seconds)
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  
  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Loading state
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Uptime state
  const [uptime, setUptime] = useState('00:00:00');

  // Toast helpers
  const addToast = (message: string, type: Toast['type']) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Uptime calculator
  useEffect(() => {
    if (!isRunning || !stats?.startTime) {
      setUptime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - stats.startTime!) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setUptime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, stats?.startTime]);

  // Listen for stats updates from main process
  useEffect(() => {
    if (window.electron && !hasLoaded) {
      window.electron.onStatsUpdate((update: StatsUpdate) => {
        setStats(update.session);
        setProxyStats(update.proxies);
        setProxyList(update.proxies.list || []);
        setIsRunning(update.session.isRunning);
        setIsLoadingStats(false);
        setHasLoaded(true);

        // Update chart history
        setCpuHistory((prev) => {
          const newHistory = [...prev, update.session.cpuUsage];
          return newHistory.slice(-60); // Keep last 60 points
        });
        setMemoryHistory((prev) => {
          const newHistory = [...prev, update.session.memoryUsage];
          return newHistory.slice(-60);
        });

        if (onStatsUpdate) {
          onStatsUpdate(update);
        }
      });

      // Request initial stats after a short delay
      const timer = setTimeout(() => {
        setIsLoadingStats(false);
        setHasLoaded(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSession = async () => {
    if (!livestreamUrl.trim()) {
      addToast('Please enter a livestream URL', 'error');
      return;
    }

    try {
      const result = await window.electron.startSession(livestreamUrl, viewerCount, platform);

      if (!result.success) {
        addToast(result.error || 'Failed to start session', 'error');
      } else {
        setIsRunning(true);
        addToast('Session started successfully', 'success');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Unknown error', 'error');
    }
  };

  const handleStopSession = async () => {
    try {
      const result = await window.electron.stopSession();

      if (!result.success) {
        addToast(result.error || 'Failed to stop session', 'error');
      } else {
        setIsRunning(false);
        addToast('Session stopped', 'info');
        // Reset chart history
        setCpuHistory([]);
        setMemoryHistory([]);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Unknown error', 'error');
    }
  };

  const handleForceStop = async () => {
    try {
      const result = await window.electron.forceStopSession();

      if (!result.success) {
        addToast(result.error || 'Failed to force stop', 'error');
      } else {
        setIsRunning(false);
        addToast('Session force stopped', 'warning');
        setCpuHistory([]);
        setMemoryHistory([]);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Unknown error', 'error');
    }
  };

  if (isLoadingStats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-lg font-medium text-gray-600">Loading dashboard...</p>
        <p className="text-sm text-gray-500 mt-2">Fetching latest stats</p>
      </div>
    );
  }

  return (
    <>
      {/* Command Center Layout: 2 columns */}
      <div className="grid lg:grid-cols-[400px_1fr] gap-6">
        {/* LEFT COLUMN: Control Panel (Sticky) */}
        <div className="lg:sticky lg:top-6 lg:h-fit space-y-4">
          {/* Quick Start Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">🚀</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Quick Start</h3>
            </div>

            <div className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setPlatform('youtube')}
                  disabled={isRunning}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    platform === 'youtube'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📺 YouTube
                </button>
                <button
                  onClick={() => setPlatform('tiktok')}
                  disabled={isRunning}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    platform === 'tiktok'
                      ? 'bg-white text-pink-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🎵 TikTok
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    🔗
                  </div>
                  <input
                    type="text"
                    placeholder={platform === 'tiktok' ? "https://tiktok.com/@user/live" : "https://youtube.com/watch?v=..."}
                    value={livestreamUrl}
                    onChange={(e) => setLivestreamUrl(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:bg-gray-100 transition-all placeholder:text-gray-400 text-gray-900"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  👥
                </div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={viewerCount}
                  onChange={(e) => setViewerCount(parseInt(e.target.value) || 10)}
                  disabled={isRunning}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:bg-gray-100 transition-all text-gray-900"
                />
                <div className="text-xs text-gray-500 mt-1 text-center">Viewer Count</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStartSession}
                  disabled={isRunning}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      Running...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      ▶️ Start
                    </span>
                  )}
                </button>
                <button
                  onClick={handleStopSession}
                  disabled={!isRunning}
                  className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 hover:scale-[1.02] active:scale-[0.98]"
                >
                  ⏹️ Stop
                </button>
              </div>
            </div>
          </div>

          {/* Session Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`relative w-4 h-4 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-400'}`}
                >
                  {isRunning && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
                      <div className="absolute inset-0 rounded-full bg-green-400 animate-pulse"></div>
                    </>
                  )}
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900">
                    {isRunning ? 'Session Active' : 'Ready to Start'}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {isRunning ? 'Viewers are watching' : 'Configure and start'}
                  </p>
                </div>
              </div>
              {isRunning && (
                <div className="text-right">
                  <div className="text-xs text-gray-600">Uptime</div>
                  <div className="font-mono text-sm text-green-600 font-bold">{uptime}</div>
                </div>
              )}
            </div>
          </div>

          {/* Force Stop Button */}
          <button
            onClick={handleForceStop}
            disabled={!isRunning}
            className="w-full px-4 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 hover:text-orange-700 text-sm"
            title="Force stop if normal stop fails"
          >
            ⚠️ Force Stop Session
          </button>
        </div>

        {/* RIGHT COLUMN: Live Monitor (Scrollable) */}
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="group relative bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-sm rounded-2xl p-6 border border-green-200 hover:border-green-300 transition-all duration-300 hover:shadow-xl hover:shadow-green-200/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  Active Viewers
                </h3>
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl">👥</span>
                </div>
              </div>
              <p className="text-4xl font-bold text-green-600 group-hover:scale-105 transition-transform">
                {stats?.activeViewers ?? 0}
              </p>
              <p className="text-xs text-gray-500 mt-2">Currently watching</p>
            </div>

            <div className="group relative bg-gradient-to-br from-blue-50 to-cyan-50 backdrop-blur-sm rounded-2xl p-6 border border-blue-200 hover:border-blue-300 transition-all duration-300 hover:shadow-xl hover:shadow-blue-200/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  Total Sessions
                </h3>
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
              </div>
              <p className="text-4xl font-bold text-blue-600 group-hover:scale-105 transition-transform">
                {stats?.totalViewers ?? 0}
              </p>
              <p className="text-xs text-gray-500 mt-2">All time viewers</p>
            </div>

            <div className="group relative bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 hover:border-purple-300 transition-all duration-300 hover:shadow-xl hover:shadow-purple-200/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  Proxies
                </h3>
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🌐</span>
                </div>
              </div>
              <p className="text-4xl font-bold text-purple-600 group-hover:scale-105 transition-transform">
                {proxyStats?.active ?? 0}{' '}
                <span className="text-2xl text-gray-400">/ {proxyStats?.total ?? 0}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">Active connections</p>
            </div>
          </div>

          {/* Resource Charts */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    CPU Usage
                  </h3>
                  <span className="text-lg font-bold text-blue-600">
                    {stats.cpuUsage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-32">
                  <RealtimeChart data={cpuHistory} label="CPU" color="blue" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    Memory Usage
                  </h3>
                  <span className="text-lg font-bold text-purple-600">
                    {stats.memoryUsage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-32">
                  <RealtimeChart data={memoryHistory} label="Memory" color="purple" />
                </div>
              </div>
            </div>
          )}

          {/* Proxy Table */}
          <ProxyTable proxies={proxyList} />
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default Dashboard;
