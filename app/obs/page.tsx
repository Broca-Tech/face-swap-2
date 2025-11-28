'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import MediaPlayer from '../../components/MediaPlayer';
import useAgora from '../../hooks/useAgora';

export default function OBSPage() {
  const searchParams = useSearchParams();
  const channelId = searchParams.get('channel');
  const appId = searchParams.get('appId');
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');

  const [client, setClient] = useState<any>(null);
  const [error, setError] = useState('');

  // Initialize Agora client
  useEffect(() => {
    (async () => {
      if (typeof window !== 'undefined') {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const c = AgoraRTC.createClient({ codec: 'vp8', mode: 'live' });
        setClient(c);
      }
    })();
  }, []);

  const { remoteUsers, setJoinState } = useAgora(client);

  // Auto-join channel when parameters are available
  useEffect(() => {
    const joinChannel = async () => {
      if (!client || !channelId || !appId || !userId) return;

      try {
        await client.setClientRole('audience');
        const numericUserId = parseInt(userId, 10) || 0;
        await client.join(appId, channelId, token || null, numericUserId + 1000);
        setJoinState(true);
      } catch (e: any) {
        console.error('Failed to join channel:', e);
        setError('チャンネルへの接続に失敗しました');
      }
    };

    joinChannel();

    return () => {
      if (client) {
        client.leave().catch(console.error);
      }
    };
  }, [client, channelId, appId, token, userId, setJoinState]);

  // Get the swapped (algorithm) user - should be the remote user with algorithmUserId
  const swappedUser = remoteUsers.find(user => user.uid !== parseInt(userId || '0', 10));

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {swappedUser?.videoTrack ? (
        // 変換後の映像を左右反転して全画面表示
        <div style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }}>
          <MediaPlayer
            videoTrack={swappedUser.videoTrack}
            audioTrack={swappedUser.audioTrack}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '18px'
        }}>
          {error ? (
            <div style={{ color: '#ef4444' }}>{error}</div>
          ) : !channelId || !appId ? (
            <div>URLパラメータが不正です</div>
          ) : (
            <>
              <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(139, 92, 246, 0.5)',
                borderTopColor: '#8b5cf6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div>変換映像を待機中...</div>
            </>
          )}
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
