'use client';

import React, { useState, useRef } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import axios from 'axios';

interface ImageUploaderProps {
  onUploadSuccess: () => void;
}

export default function ImageUploader({ onUploadSuccess }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        // Clear preview and notify parent
        setPreviewUrl(null);
        onUploadSuccess();

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200">新しい画像をアップロード</h3>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id="image-upload"
        />

        <label
          htmlFor="image-upload"
          className={`
            flex flex-col items-center justify-center
            border-2 border-dashed rounded-xl p-8
            cursor-pointer transition-all
            ${uploading
              ? 'border-gray-600 bg-gray-800/30 cursor-wait'
              : 'border-gray-600 hover:border-indigo-500/50 bg-gray-800/20 hover:bg-gray-800/40'
            }
          `}
        >
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-48 rounded-lg"
              />
              {!uploading && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    clearPreview();
                  }}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : uploading ? (
            <>
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-3" />
              <span className="text-slate-300 font-medium">アップロード中...</span>
              <span className="text-slate-500 text-sm mt-1">お待ちください</span>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-slate-400 mb-3" />
              <span className="text-slate-300 font-medium">クリックして画像をアップロード</span>
              <span className="text-slate-500 text-sm mt-1">PNG, JPG 最大10MB</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}
