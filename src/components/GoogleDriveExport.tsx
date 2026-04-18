import React, { useState, useEffect } from 'react';
import { Loader2, FileDown, Folder, CheckCircle } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

export const GoogleDriveExport = ({ result }: { result: any }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    checkConnection();

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkConnection();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/drive/status');
      const data = await res.json();
      setIsConnected(data.connected);
      if (data.connected) {
        fetchFolders();
      }
    } catch (err) {
      console.error('Failed to check Drive connection', err);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/drive/folders');
      const data = await res.json();
      if (data.folders) {
        setFolders(data.folders);
      }
    } catch (err) {
      console.error('Failed to fetch folders', err);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/auth/url');
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === "Google OAuth credentials not configured") {
          alert("Chưa cấu hình Google OAuth credentials. Vui lòng thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trong phần Settings > Secrets.");
          return;
        }
        throw new Error(data.error || 'Failed to get auth URL');
      }
      const { url } = data;

      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Vui lòng cho phép popup để kết nối Google Drive.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      alert('Không thể kết nối Google Drive.');
    }
  };

  const handleExport = async () => {
    if (!isConnected) {
      handleConnect();
      return;
    }

    if (!showFolderSelect) {
      setShowFolderSelect(true);
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      const isPricing = result.mode === 'pricing' || result.title?.includes('Báo giá');
      const elementIds = isPricing ? ['capture-page-1', 'capture-page-2'] : ['capture-doc'];
      
      // For simplicity, we'll just export the first page as an image to Drive
      // Or we can export the raw text if it's a document
      
      let content = '';
      let mimeType = 'text/plain';
      let filename = `${result.title.replace(/\s+/g, '_')}`;

      if (isPricing) {
        // Export as image
        const element = document.getElementById(elementIds[0]);
        if (element) {
          content = await htmlToImage.toPng(element, {
            pixelRatio: 2,
            backgroundColor: "#ffffff"
          });
          mimeType = 'image/png';
          filename += '.png';
        }
      } else {
        // Export as text
        content = result.content;
        mimeType = 'text/plain';
        filename += '.txt';
      }

      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          content,
          mimeType,
          folderId: selectedFolderId || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
        setShowFolderSelect(false);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Lỗi khi xuất file lên Google Drive.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={handleExport} 
        disabled={isExporting} 
        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg disabled:bg-slate-400"
      >
        {isExporting ? <Loader2 size={18} className="animate-spin"/> : (exportSuccess ? <CheckCircle size={18} /> : <FileDown size={18}/>)}
        {isExporting ? "Đang xử lý..." : (exportSuccess ? "Đã lưu" : "Lưu vào Drive")}
      </button>

      {showFolderSelect && isConnected && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase mb-3 flex items-center gap-2">
            <Folder size={14} /> Chọn thư mục lưu
          </h4>
          <select 
            className="w-full p-2 text-sm border border-slate-200 rounded-lg mb-3 focus:outline-none focus:border-blue-500"
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
          >
            <option value="">Thư mục gốc (My Drive)</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowFolderSelect(false)}
              className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Hủy
            </button>
            <button 
              onClick={handleExport}
              className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Lưu ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
