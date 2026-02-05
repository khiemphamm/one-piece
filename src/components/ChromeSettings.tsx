import React, { useState, useEffect } from 'react';

interface DetectedChromePath {
  path: string;
  source: string;
}

interface ChromeSettingsProps {
  onToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ChromeSettings: React.FC<ChromeSettingsProps> = ({ onToast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [customPath, setCustomPath] = useState('');
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [detectedPaths, setDetectedPaths] = useState<DetectedChromePath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load current config on mount
  useEffect(() => {
    loadChromeConfig();
  }, []);

  const loadChromeConfig = async () => {
    try {
      setIsLoading(true);
      const result = await window.electron.getChromePath();
      
      if (result.success && result.data) {
        setMode(result.data.config.mode);
        setCustomPath(result.data.config.customPath || '');
        setCurrentPath(result.data.currentPath);
        setDetectedPaths(result.data.detectedPaths || []);
      }
    } catch (error) {
      console.error('Failed to load Chrome config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = async (newMode: 'auto' | 'manual') => {
    setMode(newMode);
    setValidationError(null);

    if (newMode === 'auto') {
      // Save auto mode immediately
      await saveConfig(newMode, undefined);
    }
  };

  const handleBrowse = async () => {
    try {
      const result = await window.electron.browseChromePath();
      
      if (result.success && result.data && !result.data.canceled && result.data.path) {
        setCustomPath(result.data.path);
        setValidationError(null);
      } else if (!result.success) {
        setValidationError(result.error || 'Failed to browse for Chrome');
      }
    } catch (error) {
      console.error('Failed to browse Chrome path:', error);
      setValidationError('Failed to open file browser');
    }
  };

  const handleSelectDetectedPath = (path: string) => {
    setCustomPath(path);
    setValidationError(null);
  };

  const saveConfig = async (saveMode: 'auto' | 'manual', savePath?: string) => {
    try {
      setIsSaving(true);
      setValidationError(null);

      const result = await window.electron.setChromePath(saveMode, savePath);

      if (result.success && result.data) {
        setCurrentPath(result.data.currentPath);
        onToast?.('Chrome path settings saved', 'success');
      } else {
        setValidationError(result.error || 'Failed to save settings');
        onToast?.(result.error || 'Failed to save settings', 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save settings';
      setValidationError(errorMsg);
      onToast?.(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManual = async () => {
    if (!customPath.trim()) {
      setValidationError('Please enter or select a Chrome path');
      return;
    }
    await saveConfig('manual', customPath);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading Chrome settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header - Click to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-white font-semibold">Chrome Browser Settings</h3>
            <p className="text-gray-400 text-sm">
              {mode === 'auto' ? 'Auto-detect' : 'Custom path'}: {currentPath ? 
                (currentPath.length > 50 ? '...' + currentPath.slice(-50) : currentPath) : 
                'Not configured'}
            </p>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">Detection Mode</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="chromeMode"
                  value="auto"
                  checked={mode === 'auto'}
                  onChange={() => handleModeChange('auto')}
                  className="w-4 h-4 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-white">Auto-detect</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="chromeMode"
                  value="manual"
                  checked={mode === 'manual'}
                  onChange={() => handleModeChange('manual')}
                  className="w-4 h-4 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-white">Custom path</span>
              </label>
            </div>
          </div>

          {/* Manual Path Input */}
          {mode === 'manual' && (
            <div className="space-y-3">
              {/* Path Input with Browse Button */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => {
                    setCustomPath(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="Enter Chrome executable path..."
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleBrowse}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Browse</span>
                </button>
              </div>

              {/* Validation Error */}
              {validationError && (
                <p className="text-red-400 text-sm flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{validationError}</span>
                </p>
              )}

              {/* Detected Paths */}
              {detectedPaths.length > 0 && (
                <div className="space-y-2">
                  <label className="text-gray-400 text-sm">Or select from detected:</label>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {detectedPaths.map((detected, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectDetectedPath(detected.path)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          customPath === detected.path 
                            ? 'bg-blue-600/20 border border-blue-500 text-blue-300' 
                            : 'bg-gray-900 hover:bg-gray-700 text-gray-300 border border-gray-700'
                        }`}
                      >
                        <div className="font-medium">{detected.source}</div>
                        <div className="text-xs text-gray-500 truncate">{detected.path}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSaveManual}
                disabled={isSaving || !customPath.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Chrome Path</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Auto Mode Info */}
          {mode === 'auto' && (
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
              <p className="text-gray-400 text-sm mb-2">
                Chrome will be automatically detected from common installation paths.
              </p>
              {currentPath && (
                <div className="text-green-400 text-sm flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Detected: {currentPath}</span>
                </div>
              )}
              {!currentPath && (
                <div className="text-yellow-400 text-sm flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>No Chrome installation found. Please install Chrome or switch to custom path.</span>
                </div>
              )}
              
              {/* Show detected paths for reference */}
              {detectedPaths.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-gray-500 text-xs mb-2">Available Chrome installations:</p>
                  <div className="space-y-1">
                    {detectedPaths.map((detected, index) => (
                      <div key={index} className="text-xs text-gray-400">
                        • {detected.source}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChromeSettings;
