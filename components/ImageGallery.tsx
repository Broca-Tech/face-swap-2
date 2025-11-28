'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

interface CloudinaryImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  createdAt: string;
}

interface ImageGalleryProps {
  onImageSelect: (imageUrl: string) => void;
  selectedImageUrl: string | null;
  refreshTrigger?: number;
}

export default function ImageGallery({ onImageSelect, selectedImageUrl, refreshTrigger }: ImageGalleryProps) {
  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchImages = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/list-images');

      if (response.data.success) {
        setImages(response.data.images);
      }
    } catch (err: any) {
      console.error('Failed to fetch images:', err);
      setError(err.response?.data?.error || 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [refreshTrigger]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200">
          ターゲット画像を選択
        </h3>
        <button
          onClick={fetchImages}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          更新
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/20 rounded-xl border border-slate-700/50">
          <p className="text-slate-400">まだ画像がアップロードされていません</p>
          <p className="text-slate-600 text-sm mt-1">画像をアップロードして開始</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image) => {
            const isSelected = selectedImageUrl === image.url;

            return (
              <button
                key={image.publicId}
                onClick={() => onImageSelect(image.url)}
                className={`
                  relative group overflow-hidden rounded-lg
                  transition-all duration-200
                  ${isSelected
                    ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/50'
                    : 'ring-1 ring-gray-700 hover:ring-gray-600'
                  }
                `}
              >
                <div className="aspect-square bg-gray-900">
                  <img
                    src={image.url}
                    alt="Target face"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-indigo-500 text-white p-1 rounded-full">
                    <CheckCircle2 size={16} />
                  </div>
                )}

                {/* Hover overlay */}
                <div className={`
                  absolute inset-0 bg-black/60 flex items-center justify-center
                  transition-opacity
                  ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}
                `}>
                  <span className="text-white text-sm font-medium">選択</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
