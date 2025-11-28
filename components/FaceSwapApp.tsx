'use client';

import React, { useState, useEffect } from 'react';
import useAgora from '../hooks/useAgora';
import MediaPlayer from './MediaPlayer';
import axios from 'axios';

interface AkoolSession {
  sessionId: string;
  status: number;
  agora: {
    channelId: string;
    userId: string;
    token: string;
    appId: string;
    algorithmUserId: string;
  };
}

interface CloudinaryImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  createdAt: string;
}

export default function FaceSwapApp() {
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (typeof window !== 'undefined') {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const c = AgoraRTC.createClient({ codec: 'vp8', mode: 'live' });
        setClient(c);
      }
    })();
  }, []);

  const {
    localVideoTrack, localAudioTrack, setLocalVideoTrack, setLocalAudioTrack,
    joinState, setJoinState, remoteUsers
  } = useAgora(client);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [akoolSession, setAkoolSession] = useState<AkoolSession | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDualView, setShowDualView] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 自動でカメラをONにする
  useEffect(() => {
    const autoStartCamera = async () => {
      if (typeof window !== 'undefined' && !localVideoTrack) {
        try {
          const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
          const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { encoderConfig: 'music_standard' },
            {
              encoderConfig: {
                width: 640,
                height: 480,
                frameRate: 20,
                bitrateMin: 400,
                bitrateMax: 1000,
              },
            }
          );
          setLocalAudioTrack(microphoneTrack);
          setLocalVideoTrack(cameraTrack);
        } catch (e: any) {
          setError('カメラへのアクセスに失敗しました');
        }
      }
    };
    autoStartCamera();
  }, [localVideoTrack, setLocalAudioTrack, setLocalVideoTrack]);

  useEffect(() => {
    return () => {
      if (akoolSession?.sessionId) {
        axios.post('/api/close-session', { sessionId: akoolSession.sessionId }).catch(console.error);
      }
    };
  }, [akoolSession?.sessionId]);

  const fetchImages = async () => {
    try {
      const response = await axios.get('/api/list-images');
      if (response.data.success) {
        setImages(response.data.images);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('画像は10MB以下にしてください');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('/api/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // アップロード成功後、レスポンスから画像情報を取得して即座に追加
      if (response.data.success) {
        const newImage: CloudinaryImage = {
          publicId: response.data.publicId,
          url: response.data.url,
          width: response.data.width,
          height: response.data.height,
          createdAt: new Date().toISOString()
        };
        setImages(prevImages => [...prevImages, newImage]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'アップロード失敗');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (publicId: string) => {
    setDeletingId(publicId);
    try {
      const response = await axios.post('/api/delete-image', { publicId });
      if (response.data.success) {
        // 選択中の画像が削除された場合は選択解除
        const deletedImage = images.find(img => img.publicId === publicId);
        if (deletedImage && selectedImageUrl === deletedImage.url) {
          setSelectedImageUrl(null);
        }
        await fetchImages();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  const startSwapSession = async () => {
    if (!client || !localVideoTrack || !localAudioTrack || !selectedImageUrl) {
      return;
    }

    try {
      setIsStreaming(true);
      setError('');

      const response = await axios.post('/api/start-swap', {
        sourceImageUrl: selectedImageUrl,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'セッション作成失敗');
      }

      const session: AkoolSession = response.data;
      setAkoolSession(session);

      const { channelId, userId, token, appId } = session.agora;
      await client.setClientRole('host');
      const numericUserId = parseInt(userId, 10) || 0;
      await client.join(appId, channelId, token || null, numericUserId);
      await client.publish([localAudioTrack, localVideoTrack]);
      setJoinState(true);
    } catch (e: any) {
      setError('セッション開始失敗');
      setIsStreaming(false);

      if (joinState) {
        try {
          await client.leave();
        } catch (leaveError) {
          console.error('Error leaving channel:', leaveError);
        }
        setJoinState(false);
      }
    }
  };

  const stopSwapSession = async () => {
    if (!client) return;

    try {
      if (localAudioTrack && localVideoTrack) {
        await client.unpublish([localAudioTrack, localVideoTrack]);
      }
      await client.leave();
      setJoinState(false);

      if (akoolSession?.sessionId) {
        await axios.post('/api/close-session', { sessionId: akoolSession.sessionId });
      }

      setAkoolSession(null);
      setIsStreaming(false);
    } catch (e: any) {
      setError('セッション停止エラー');
    }
  };

  const swappedUser = remoteUsers.length > 0 ? remoteUsers[0] : null;
  const canStart = localVideoTrack && selectedImageUrl;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0f 0%, #12121a 100%)',
      padding: '40px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px'
    }}>
      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        gap: '32px',
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Left Panel - Face Selection */}
        <section style={{
          width: '420px',
          flexShrink: 0,
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Section Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#ffffff',
                margin: 0
              }}>
                顔を選択
              </h2>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'help'
              }}>
                i
              </div>
            </div>
            {images.length > 0 && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: isEditMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  color: isEditMode ? '#f87171' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                {isEditMode ? '完了' : '編集'}
              </button>
            )}
          </div>

          {/* Upload Button - 小さく */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '2px solid #8b5cf6',
            background: 'rgba(139, 92, 246, 0.1)',
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'all 0.2s'
          }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #8b5cf6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </label>

          {/* Image Grid */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            alignContent: 'start',
            padding: isEditMode ? '12px' : '0',
            margin: isEditMode ? '-12px' : '0'
          }}>
            {images.map((image) => (
              <div
                key={image.publicId}
                style={{
                  position: 'relative',
                  aspectRatio: '1'
                }}
              >
                <button
                  onClick={() => !isEditMode && setSelectedImageUrl(image.url)}
                  disabled={isEditMode}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: selectedImageUrl === image.url
                      ? '3px solid #8b5cf6'
                      : '3px solid transparent',
                    padding: 0,
                    background: 'none',
                    cursor: isEditMode ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: selectedImageUrl === image.url
                      ? '0 0 20px rgba(139, 92, 246, 0.4)'
                      : 'none',
                    opacity: isEditMode ? 0.7 : 1
                  }}
                >
                  <img
                    src={image.url}
                    alt="顔画像"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                </button>
                {/* 削除ボタン（編集モード時のみ表示） */}
                {isEditMode && (
                  <button
                    onClick={() => handleDeleteImage(image.publicId)}
                    disabled={deletingId === image.publicId}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 'none',
                      background: '#ef4444',
                      cursor: deletingId === image.publicId ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      transition: 'transform 0.2s',
                      zIndex: 10
                    }}
                    onMouseOver={(e) => {
                      if (deletingId !== image.publicId) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {deletingId === image.publicId ? (
                      <div style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Right Panel - Video Preview */}
        <section style={{
          flex: 1,
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Video Area */}
          <div style={{
            flex: 1,
            position: 'relative',
            background: '#000',
            margin: '24px',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Main Video (Swapped or Local) */}
            <div style={{
              flex: showDualView ? 1 : 'auto',
              height: showDualView ? '50%' : '100%',
              position: 'relative'
            }}>
              {swappedUser ? (
                // 変換後の映像 - 反転あり
                <div style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }}>
                  <MediaPlayer
                    videoTrack={swappedUser.videoTrack}
                    audioTrack={swappedUser.audioTrack}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : localVideoTrack ? (
                // オリジナルカメラ映像 - 反転なし
                <MediaPlayer
                  videoTrack={localVideoTrack}
                  audioTrack={undefined}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  カメラを起動中...
                </div>
              )}
            </div>

            {/* Secondary Video (Original Camera - only in dual view mode) */}
            {showDualView && localVideoTrack && swappedUser && (
              <div style={{
                flex: 1,
                height: '50%',
                borderTop: '2px solid rgba(255, 255, 255, 0.1)',
                position: 'relative'
              }}>
                <MediaPlayer
                  videoTrack={localVideoTrack}
                  audioTrack={undefined}
                  className="w-full h-full object-cover"
                />
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(0, 0, 0, 0.6)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  オリジナル
                </div>
              </div>
            )}

            {/* Face Swap Watermark */}
            <div style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255, 255, 255, 0.3)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 8a3 3 0 11-6 0 3 3 0 016 0zM6.5 20a6.5 6.5 0 0111 0" />
              </svg>
              <span style={{
                fontSize: '16px',
                fontWeight: '600',
                letterSpacing: '0.05em'
              }}>
                face swap
              </span>
            </div>
          </div>

          {/* Bottom Controls - ツールバー */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 32px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.2)'
          }}>
            {/* Left: View Toggle (変換中のみ表示) */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {isStreaming && swappedUser && (
                <button
                  onClick={() => setShowDualView(!showDualView)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: showDualView ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="8" rx="2" />
                    <rect x="3" y="13" width="18" height="8" rx="2" />
                  </svg>
                  {showDualView ? '単一表示' : '比較表示'}
                </button>
              )}
            </div>

            {/* Right: Start/Stop Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {!isStreaming ? (
                <button
                  onClick={startSwapSession}
                  disabled={!canStart}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 32px',
                    borderRadius: '50px',
                    border: 'none',
                    background: canStart
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #d946ef 100%)'
                      : 'rgba(255, 255, 255, 0.1)',
                    cursor: canStart ? 'pointer' : 'not-allowed',
                    color: canStart ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                    fontSize: '16px',
                    fontWeight: '600',
                    boxShadow: canStart ? '0 4px 24px rgba(139, 92, 246, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  変換開始
                </button>
              ) : (
                <button
                  onClick={stopSwapSession}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 32px',
                    borderRadius: '50px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
                    cursor: 'pointer',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: '600',
                    boxShadow: '0 4px 24px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                  変換終了
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Error Message */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '16px 32px',
          borderRadius: '50px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 24px rgba(239, 68, 68, 0.4)',
          zIndex: 1000
        }}>
          {error}
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
