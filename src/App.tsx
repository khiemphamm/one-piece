import React, { useState, useEffect } from 'react';
import type { StatsUpdate } from './types';

function App() {
  const [livestreamUrl, setLivestreamUrl] = useState('');
  const [viewerCount, setViewerCount] = useState(10); // REDUCED from 20 to 10 for stability
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<StatsUpdate['session'] | null>(null);
  const [proxyStats, setProxyStats] = useState<StatsUpdate['proxies'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for stats updates from main process
  useEffect(() => {
    if (window.electron) {
      window.electron.onStatsUpdate((update: StatsUpdate) => {
        setStats(update.session);
        setProxyStats(update.proxies);
        setIsRunning(update.session.isRunning);
      });
    }
  }, []);

  const handleStartSession = async () => {
    if (!livestreamUrl.trim()) {
      setError('Please enter a livestream URL');
      return;
    }

    try {
      setError(null);
      const result = await window.electron.startSession(livestreamUrl, viewerCount);
      
      if (!result.success) {
        setError(result.error || 'Failed to start session');
      } else {
        setIsRunning(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleStopSession = async () => {
    try {
      setError(null);
      const result = await window.electron.stopSession();
      
      if (!result.success) {
        setError(result.error || 'Failed to stop session');
      } else {
        setIsRunning(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleForceStop = async () => {
    try {
      setError(null);
      const result = await window.electron.forceStopSession();
      
      if (!result.success) {
        setError(result.error || 'Failed to force stop');
      } else {
        setIsRunning(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Tool Live</h1>
          <p className="text-gray-400">YouTube Livestream Viewer Management</p>
        </header>

        <main className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>
            <p className="text-gray-400">
              Setting up your livestream viewer bot...
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Active Viewers</h3>
              <p className="text-3xl font-bold text-green-400">
                {stats?.activeViewers ?? 0}
              </p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Total Sessions</h3>
              <p className="text-3xl font-bold text-blue-400">
                {stats?.totalViewers ?? 0}
              </p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Proxies</h3>
              <p className="text-3xl font-bold text-purple-400">
                {proxyStats?.active ?? 0} / {proxyStats?.total ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
            
            {error && (
              <div className="mb-4 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Enter YouTube livestream URL..."
                  value={livestreamUrl}
                  onChange={(e) => setLivestreamUrl(e.target.value)}
                  disabled={isRunning}
                  className="flex-1 bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={viewerCount}
                  onChange={(e) => setViewerCount(parseInt(e.target.value) || 20)}
                  disabled={isRunning}
                  className="w-20 bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleStartSession}
                  disabled={isRunning}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? 'Session Running...' : 'Start Session'}
                </button>
                <button 
                  onClick={handleStopSession}
                  disabled={!isRunning}
                  className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Stop All
                </button>
                <button 
                  onClick={handleForceStop}
                  disabled={!isRunning}
                  className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  title="Use if normal stop fails"
                >
                  Force Stop
                </button>
              </div>
            </div>
          </div>

          {/* Resource Usage */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">CPU Usage</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-4">
                    <div 
                      className="bg-blue-500 h-4 rounded-full transition-all"
                      style={{ width: `${Math.min(stats.cpuUsage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-mono">{stats.cpuUsage.toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Memory Usage</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-4">
                    <div 
                      className="bg-purple-500 h-4 rounded-full transition-all"
                      style={{ width: `${Math.min(stats.memoryUsage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-mono">{stats.memoryUsage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Status Indicator */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-sm font-medium">
                {isRunning ? 'Session Active' : 'Idle'}
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
