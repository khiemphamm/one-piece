import React, { useState, useEffect } from 'react';

interface UpdateNotificationProps {
  onInstall: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onInstall }) => {
  const [show, setShow] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (window.electron) {
      window.electron.onUpdateAvailable(_info => {
        setShow(true);
      });

      window.electron.onUpdateDownloaded(_info => {
        setDownloaded(true);
      });
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-fade-in">
      <div className="bg-white border border-blue-200 rounded-2xl shadow-2xl p-6 max-w-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🚀</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">
              {downloaded ? 'Update Ready!' : 'New Version Available'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {downloaded
                ? 'The new version has been downloaded. Restart now to install.'
                : 'A new update is available. It will be downloaded in the background.'}
            </p>

            <div className="mt-4 flex gap-3">
              {downloaded ? (
                <button
                  onClick={onInstall}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                >
                  Restart & Install
                </button>
              ) : (
                <button
                  onClick={() => setShow(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-all"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
