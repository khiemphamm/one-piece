import React, { useState, useEffect, useRef } from 'react';

export interface LogEntry {
  id: string;
  index: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface LogsPanelProps {
  maxLogs?: number;
}

// Terminal-style colors for log levels
const levelTerminalColors: Record<string, string> = {
  info: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-gray-400',
};

const levelIcons: Record<string, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  debug: '🔍',
};

// Counter for log index
let logCounter = 0;

export const LogsPanel: React.FC<LogsPanelProps> = ({ maxLogs = 500 }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for log events from main process
  useEffect(() => {
    if (window.electron) {
      setIsConnected(true);
      
      window.electron.onLog((log: Record<string, unknown>) => {
        const levelValue = log.level as string;
        const validLevels = ['info', 'warn', 'error', 'debug'];
        logCounter++;
        const newLog: LogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          index: logCounter,
          level: (validLevels.includes(levelValue) ? levelValue : 'info') as LogEntry['level'],
          message: (log.message as string) || JSON.stringify(log),
          timestamp: (log.timestamp as string) || new Date().toISOString(),
          context: (log.context || log.metadata) as Record<string, unknown> | undefined,
        };

        setLogs(prevLogs => {
          const updatedLogs = [...prevLogs, newLog];
          // Keep only the last maxLogs entries
          if (updatedLogs.length > maxLogs) {
            return updatedLogs.slice(-maxLogs);
          }
          return updatedLogs;
        });
      });
    }
  }, [maxLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter;
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.context && JSON.stringify(log.context).toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    logCounter = 0; // Reset counter when clearing logs
  };

  // Export logs in terminal format
  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.index}] ${log.timestamp} [${log.level}] ${log.message}${log.context ? ' ' + JSON.stringify(log.context) : ''}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format timestamp like terminal: YYYY-MM-DD HH:mm:ss
  const formatTimestamp = (timestamp: string) => {
    try {
      // If already in the right format, return as-is
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(timestamp)) {
        return timestamp;
      }
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">📋</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Logs</h2>
            <p className="text-gray-600">Real-time application logs</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['all', 'info', 'warn', 'error', 'debug'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filter === level
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {level === 'all' ? 'All' : levelIcons[level]}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                autoScroll
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
              title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
            >
              {autoScroll ? '⬇️ Auto' : '⏸️ Paused'}
            </button>
            <button
              onClick={exportLogs}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-all"
              title="Export logs"
            >
              📥 Export
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
              title="Clear logs"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Log Stats */}
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-200 text-sm">
          <span className="text-gray-600">
            Total: <strong className="text-gray-900">{logs.length}</strong>
          </span>
          <span className="text-blue-600">
            Info: <strong>{logs.filter(l => l.level === 'info').length}</strong>
          </span>
          <span className="text-yellow-600">
            Warn: <strong>{logs.filter(l => l.level === 'warn').length}</strong>
          </span>
          <span className="text-red-600">
            Error: <strong>{logs.filter(l => l.level === 'error').length}</strong>
          </span>
          <span className="text-gray-500">
            Debug: <strong>{logs.filter(l => l.level === 'debug').length}</strong>
          </span>
        </div>
      </div>

      {/* Logs Container - Terminal Style */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-gray-900 rounded-2xl border border-gray-700 shadow-xl overflow-hidden"
      >
        <div className="h-[500px] overflow-y-auto font-mono text-sm p-4">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="text-4xl mb-3">📭</span>
              <p className="font-sans">No logs yet</p>
              <p className="font-sans text-xs mt-1">Logs will appear here when the application runs</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log) => {
                const levelColor = levelTerminalColors[log.level] || levelTerminalColors.info;
                const contextStr = log.context && Object.keys(log.context).length > 0 
                  ? ' ' + JSON.stringify(log.context) 
                  : '';
                
                return (
                  <div
                    key={log.id}
                    className="group hover:bg-gray-800/50 px-2 py-0.5 rounded transition-colors leading-relaxed"
                  >
                    {/* Terminal format: [index] timestamp [level] message {context} */}
                    <span className="text-gray-500">[{log.index}]</span>
                    {' '}
                    <span className="text-gray-400">{formatTimestamp(log.timestamp)}</span>
                    {' '}
                    <span className={levelColor}>[{log.level}]</span>
                    {' '}
                    <span className="text-gray-200">{log.message}</span>
                    {contextStr && (
                      <span className="text-cyan-400">{contextStr}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default LogsPanel;
