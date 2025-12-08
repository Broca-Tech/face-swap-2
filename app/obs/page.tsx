'use client';

import { useState, useEffect, useRef } from 'react';

// グローバルに公開する型
declare global {
  interface Window {
    setVideoStream?: (stream: MediaStream) => void;
    clearVideoStream?: () => void;
    obsReady?: boolean;
  }
}

export default function OBSPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);

  useEffect(() => {
    document.title = 'Face Swap - OBS用';

    // メインページから呼び出される関数を設定
    window.setVideoStream = (stream: MediaStream) => {
      console.log('setVideoStream called with:', stream);
      console.log('stream tracks:', stream.getTracks());
      // streamをstateに保存（videoRefがまだnullの可能性があるため）
      setPendingStream(stream);
    };

    window.clearVideoStream = () => {
      setPendingStream(null);
      setIsReceiving(false);
    };

    // 準備完了フラグ
    window.obsReady = true;
    console.log('OBS page ready, window.setVideoStream is set');

    return () => {
      delete window.setVideoStream;
      delete window.clearVideoStream;
      delete window.obsReady;
    };
  }, []);

  // pendingStreamが設定されたらvideoに適用
  useEffect(() => {
    if (pendingStream && videoRef.current) {
      console.log('Applying stream to video element');
      videoRef.current.srcObject = pendingStream;
      videoRef.current.play()
        .then(() => {
          console.log('Video playing successfully');
          setIsReceiving(true);
        })
        .catch((err) => {
          console.error('Video play error:', err);
        });
    }
  }, [pendingStream]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* videoは常にDOMに存在させる（refが取れるように） */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)', // 左右反転
          display: isReceiving ? 'block' : 'none'
        }}
      />

      {/* 待機中の表示 */}
      {!isReceiving && (
        <div style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '18px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid rgba(139, 92, 246, 0.5)',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div>変換映像を待機中...</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            メインページで変換を開始してください
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
