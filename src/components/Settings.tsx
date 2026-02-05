import React from 'react';
import { ChromeSettings } from './ChromeSettings';

interface SettingsProps {
  onToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const Settings: React.FC<SettingsProps> = ({ onToast }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-2xl">⚙️</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600">Configure application settings</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Browser Settings Section */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">🌐</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Browser Settings</h3>
          </div>
          
          <ChromeSettings onToast={onToast} />
        </div>

        {/* Future Settings Sections can be added here */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg opacity-60">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">🔧</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
          </div>
          <p className="text-gray-500 text-sm">More settings coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
