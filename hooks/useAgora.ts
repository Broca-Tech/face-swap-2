import { useState, useEffect } from 'react';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';

export default function useAgora(client: IAgoraRTCClient | undefined) {
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | undefined>(undefined);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | undefined>(undefined);
  const [joinState, setJoinState] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

  useEffect(() => {
    if (!client) return;

    setRemoteUsers(client.remoteUsers);

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prevUsers) => {
        // update existing user or add new one
        return Array.from(client.remoteUsers);
      });
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prevUsers) => {
        return Array.from(client.remoteUsers);
      });
    };

    const handleUserJoined = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prevUsers) => {
        return Array.from(client.remoteUsers);
      });
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prevUsers) => {
        return Array.from(client.remoteUsers);
      });
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-joined', handleUserJoined);
    client.on('user-left', handleUserLeft);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-joined', handleUserJoined);
      client.off('user-left', handleUserLeft);
    };
  }, [client]);

  return {
    localVideoTrack,
    localAudioTrack,
    setLocalVideoTrack,
    setLocalAudioTrack,
    joinState,
    setJoinState,
    remoteUsers,
  };
}
