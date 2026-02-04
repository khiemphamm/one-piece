import React, { useEffect, useMemo, useState } from 'react';
import type { UpdateInfo } from '../types';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';

const statusConfig: Record<UpdateStatus, { label: string; className: string }> = {
  idle: { label: 'Chưa kiểm tra', className: 'bg-gray-100 text-gray-700' },
  checking: { label: 'Đang kiểm tra...', className: 'bg-blue-100 text-blue-700' },
  available: { label: 'Có bản cập nhật', className: 'bg-amber-100 text-amber-700' },
  'not-available': { label: 'Đã là phiên bản mới nhất', className: 'bg-green-100 text-green-700' },
  downloaded: { label: 'Đã tải xong', className: 'bg-purple-100 text-purple-700' },
  error: { label: 'Lỗi cập nhật', className: 'bg-red-100 text-red-700' },
};

const formatTime = (value: Date | null) => {
  if (!value) return '—';
  return value.toLocaleString();
};

const UpdateCenter: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('—');
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then(response => {
        if (response?.success && response.data?.version) {
          setCurrentVersion(response.data.version);
        }
      });
    }

    if (window.electron) {
      window.electron.onUpdateAvailable((info: UpdateInfo) => {
        setStatus('available');
        setAvailableVersion(info?.version ?? null);
        setErrorMessage(null);
        setLastCheckedAt(new Date());
      });

      window.electron.onUpdateNotAvailable((_info: UpdateInfo) => {
        setStatus('not-available');
        setAvailableVersion(null);
        setErrorMessage(null);
        setLastCheckedAt(new Date());
      });

      window.electron.onUpdateDownloaded((info: UpdateInfo) => {
        setStatus('downloaded');
        setAvailableVersion(prev => info?.version ?? prev);
        setErrorMessage(null);
        setLastCheckedAt(new Date());
      });

      window.electron.onUpdateError(error => {
        setStatus('error');
        setErrorMessage(error?.message ?? 'Update failed');
        setLastCheckedAt(new Date());
      });
    }
  }, []);

  const statusBadge = useMemo(() => {
    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  }, [status]);

  const handleCheckUpdates = async () => {
    if (!window.electron?.checkForUpdates) {
      setStatus('error');
      setErrorMessage('Updater is not available.');
      return;
    }

    setStatus('checking');
    setErrorMessage(null);
    setLastCheckedAt(new Date());

    const result = await window.electron.checkForUpdates();
    if (!result?.success) {
      setStatus('error');
      setErrorMessage(result?.error ?? 'Update failed');
    }
  };

  const handleInstall = () => {
    if (window.electron?.installUpdate) {
      window.electron.installUpdate();
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Kiểm tra cập nhật</h2>
              <p className="text-sm text-gray-600 mt-1">
                Kiểm tra phiên bản mới nhất từ GitHub Releases và cài đặt ngay khi sẵn sàng.
              </p>
            </div>
            {statusBadge}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Phiên bản hiện tại
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">{currentVersion}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Phiên bản mới nhất
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {availableVersion ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Lần kiểm tra cuối: {formatTime(lastCheckedAt)}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCheckUpdates}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                Kiểm tra cập nhật
              </button>
              <button
                onClick={handleInstall}
                disabled={status !== 'downloaded'}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                  status === 'downloaded'
                    ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                }`}
              >
                Restart & Install
              </button>
            </div>
          </div>

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {errorMessage ?? 'Update failed. Please try again.'}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            Auto-update chỉ hỗ trợ bản cài đặt <span className="font-semibold">NSIS</span>. Bản
            portable sẽ không tự cập nhật.
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateCenter;
