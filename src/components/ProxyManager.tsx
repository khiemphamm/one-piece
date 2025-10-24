import React, { useState, useEffect } from 'react';
import type { Proxy, ProxyStats, IPCResponse } from '../types';

const ProxyManager: React.FC = () => {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [proxyStats, setProxyStats] = useState<ProxyStats | null>(null);
  const [newProxies, setNewProxies] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load proxies on mount
  useEffect(() => {
    loadProxies();
  }, []);

  const loadProxies = async () => {
    if (!window.electron) return;
    
    try {
      const result: IPCResponse<{ proxies: Proxy[]; stats: ProxyStats }> = await window.electron.getProxies();
      if (result.success && result.data) {
        setProxies(result.data.proxies);
        setProxyStats(result.data.stats);
      }
    } catch (error) {
      console.error('Failed to load proxies:', error);
    }
  };

  const handleAddProxies = async () => {
    if (!newProxies.trim()) {
      showMessage('error', 'Please enter at least one proxy');
      return;
    }

    setIsLoading(true);
    try {
      const proxyList = newProxies
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const result = await window.electron.addProxies(proxyList);
      
      if (result.success) {
        showMessage('success', `Added ${proxyList.length} proxies successfully!`);
        setNewProxies('');
        await loadProxies();
      } else {
        showMessage('error', result.error || 'Failed to add proxies');
      }
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveProxy = async (proxyId: number) => {
    if (!confirm('Are you sure you want to remove this proxy?')) return;

    try {
      const result = await window.electron.removeProxy(proxyId);
      
      if (result.success) {
        showMessage('success', 'Proxy removed successfully');
        await loadProxies();
      } else {
        showMessage('error', result.error || 'Failed to remove proxy');
      }
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-900/50 text-green-400';
      case 'failed': return 'bg-red-900/50 text-red-400';
      case 'pending': return 'bg-yellow-900/50 text-yellow-400';
      default: return 'bg-gray-900/50 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Total Proxies</h3>
          <p className="text-2xl font-bold">{proxyStats?.total ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Active</h3>
          <p className="text-2xl font-bold text-green-400">{proxyStats?.active ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Failed</h3>
          <p className="text-2xl font-bold text-red-400">{proxyStats?.failed ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Available Capacity</h3>
          <p className="text-2xl font-bold text-blue-400">
            {proxyStats?.availableCapacity ?? 0}
          </p>
        </div>
      </div>

      {/* Add Proxies Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Add Proxies</h2>
        
        {message && (
          <div className={`mb-4 px-4 py-3 rounded ${
            message.type === 'success' 
              ? 'bg-green-900/50 border border-green-500 text-green-200' 
              : 'bg-red-900/50 border border-red-500 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Proxy List (one per line)
            </label>
            <textarea
              value={newProxies}
              onChange={(e) => setNewProxies(e.target.value)}
              placeholder="http://proxy1.com:8080&#10;socks5://user:pass@proxy2.com:1080&#10;http://123.45.67.89:3128"
              rows={8}
              className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              Supported formats: http://host:port, https://host:port, socks5://host:port, or with auth: protocol://user:pass@host:port
            </p>
          </div>
          
          <button 
            onClick={handleAddProxies}
            disabled={isLoading || !newProxies.trim()}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Adding...' : 'Add Proxies'}
          </button>
        </div>
      </div>

      {/* Proxy List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Proxy List ({proxies.length})</h2>
          <button 
            onClick={loadProxies}
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition"
          >
            🔄 Refresh
          </button>
        </div>

        {proxies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No proxies added yet</p>
            <p className="text-sm">Add proxies above to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Proxy URL</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Viewers</th>
                  <th className="pb-3 font-medium">Success / Fail</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proxies.map((proxy) => (
                  <tr key={proxy.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                    <td className="py-3 text-sm text-gray-400">#{proxy.id}</td>
                    <td className="py-3 text-sm font-mono">{proxy.proxy_url}</td>
                    <td className="py-3">
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                        {proxy.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusBadge(proxy.status)}`}>
                        {proxy.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-sm">
                      <span className={proxy.current_viewers >= proxy.max_viewers_per_proxy ? 'text-red-400' : 'text-gray-300'}>
                        {proxy.current_viewers} / {proxy.max_viewers_per_proxy}
                      </span>
                    </td>
                    <td className="py-3 text-sm">
                      <span className="text-green-400">{proxy.success_count}</span>
                      {' / '}
                      <span className="text-red-400">{proxy.fail_count}</span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleRemoveProxy(proxy.id)}
                        className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProxyManager;
