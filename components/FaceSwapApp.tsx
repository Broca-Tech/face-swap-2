'use client';

import React, { useState, useEffect, useRef } from 'react';
import useAgora from '../hooks/useAgora';
import MediaPlayer from './MediaPlayer';
import { Camera, RefreshCw, AlertCircle, Play, Square, CheckCircle } from 'lucide-react';
import axios from 'axios';

// Session state type
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

export default function FaceSwapApp() {
  const [client, setClient] = useState<any>(null);

  // Initialize Agora client on mount
  useEffect(() => {
    (async () => {
      if (typeof window !== 'undefined') {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        // Use 'live' mode for better compatibility with AKOOL's streaming
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
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [akoolSession, setAkoolSession] = useState<AkoolSession | null>(null);

  // Debug: Monitor localVideoTrack state
  useEffect(() => {
    console.log('localVideoTrack state changed:', localVideoTrack);
  }, [localVideoTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (akoolSession?.sessionId) {
        axios.post('/api/close-session', { sessionId: akoolSession.sessionId }).catch(console.error);
      }
    };
  }, [akoolSession?.sessionId]);

  const startCamera = async () => {
    try {
      setStatusMessage('Accessing camera...');
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      // Create tracks with recommended settings for face swap
      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {
          encoderConfig: 'music_standard',
        },
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

      console.log('Camera track created:', cameraTrack);
      console.log('Microphone track created:', microphoneTrack);

      setLocalAudioTrack(microphoneTrack);
      setLocalVideoTrack(cameraTrack);
      setError('');
      setStatusMessage('Camera ready');

      console.log('State updated with tracks');
    } catch (e: any) {
      console.error(e);
      if (e.code === 'PERMISSION_DENIED' || e.name === 'NotAllowedError') {
        setError('Camera/Microphone permission denied. Please allow access in your browser settings.');
      } else {
        setError('Failed to access camera/microphone: ' + e.message);
      }
      setStatusMessage('');
    }
  };

  const stopCamera = () => {
    localAudioTrack?.close();
    localVideoTrack?.close();
    setLocalAudioTrack(undefined);
    setLocalVideoTrack(undefined);
    setStatusMessage('');
  };

  const startSwapSession = async () => {
    if (!client || !localVideoTrack || !localAudioTrack) {
      setError('Camera not ready');
      return;
    }

    try {
      setIsStreaming(true);
      setIsSwapping(true);
      setError('');

      // Step 1: Call backend to create AKOOL session
      // This will detect faces and create the session, returning Agora credentials
      setStatusMessage('Creating face swap session...');

      const response = await axios.post('/api/start-swap', {
        // You can pass a custom source image URL here
        // sourceImageUrl: 'https://example.com/face.jpg',
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create session');
      }

      const session: AkoolSession = response.data;
      setAkoolSession(session);

      console.log('AKOOL Session created:', session);
      setStatusMessage(`Session created. Status: ${session.status}. Connecting to Agora...`);

      // Step 2: Wait for status to be 2 (ready for connection)
      // In practice, status might already be 2 when returned
      if (session.status < 2) {
        setStatusMessage('Waiting for AKOOL to be ready...');
        // You might need to poll here if status is 1
        // For now, we'll proceed and let Agora connection handle it
      }

      // Step 3: Join the Agora channel provided by AKOOL
      // IMPORTANT: Use the credentials returned by AKOOL, not our own
      const { channelId, userId, token, appId } = session.agora;

      console.log('Joining Agora channel:', { channelId, userId, appId: appId ? 'present' : 'missing' });

      // Set client role to host so we can publish
      await client.setClientRole('host');

      // Join the channel with AKOOL-provided credentials
      // userId needs to be converted to number if it's a string
      const numericUserId = parseInt(userId, 10) || 0;

      await client.join(
        appId,
        channelId,
        token || null,
        numericUserId
      );

      setStatusMessage('Connected to Agora. Publishing stream...');

      // Step 4: Publish our local stream to the channel
      // AKOOL will receive our stream, process it, and publish the result
      await client.publish([localAudioTrack, localVideoTrack]);

      setJoinState(true);
      setStatusMessage('Stream published. Waiting for face swap result...');

      console.log('Successfully joined and published. Waiting for AKOOL to send swapped stream...');

    } catch (e: any) {
      console.error('Failed to start session:', e);
      console.error('Response data:', e.response?.data);
      const errorDetails = e.response?.data?.details
        ? JSON.stringify(e.response.data.details)
        : '';
      setError(
        'Failed to start session: ' +
        (e.response?.data?.error || e.message) +
        (errorDetails ? ` (${errorDetails})` : '')
      );
      setIsStreaming(false);
      setIsSwapping(false);
      setStatusMessage('');

      // Cleanup
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
      setStatusMessage('Stopping session...');

      // Unpublish and leave Agora channel
      if (localAudioTrack && localVideoTrack) {
        await client.unpublish([localAudioTrack, localVideoTrack]);
      }
      await client.leave();
      setJoinState(false);

      // Close AKOOL session
      if (akoolSession?.sessionId) {
        await axios.post('/api/close-session', { sessionId: akoolSession.sessionId });
      }

      setAkoolSession(null);
      setIsStreaming(false);
      setIsSwapping(false);
      setStatusMessage('Session stopped');

    } catch (e: any) {
      console.error('Error stopping session:', e);
      setError('Error stopping session: ' + e.message);
    }
  };

  // Find the swapped stream from remote users
  // AKOOL joins the channel with algorithm_user_id and publishes the swapped result
  const swappedUser = remoteUsers.length > 0 ? remoteUsers[0] : null;

  // Debug: Log remote users when they change
  useEffect(() => {
    console.log('Remote users updated:', remoteUsers.map(u => ({
      uid: u.uid,
      hasVideo: !!u.videoTrack,
      hasAudio: !!u.audioTrack,
    })));

    if (swappedUser) {
      setStatusMessage('Face swap stream received!');
    }
  }, [remoteUsers, swappedUser]);

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-gray-900 to-gray-800">
      <header className="text-center space-y-4">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          Live Face Swap
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Real-time AI face transformation. Powered by AKOOL & Agora.
        </p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 max-w-xl">
          <AlertCircle size={20} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && !error && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-6 py-4 rounded-xl flex items-center gap-3 max-w-xl">
          {swappedUser ? (
            <CheckCircle size={20} className="flex-shrink-0" />
          ) : (
            <RefreshCw size={20} className="flex-shrink-0 animate-spin" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
        {/* Local Feed - Your camera */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-200">Your Camera</h2>
            <span className={`px-3 py-1 rounded-full text-sm ${
              localVideoTrack
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}>
              {localVideoTrack ? 'Camera Active' : 'Camera Off'}
            </span>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-2">
            <MediaPlayer
              videoTrack={localVideoTrack}
              audioTrack={undefined} // Don't play local audio to avoid feedback
              className="rounded-xl bg-black/50"
            />
          </div>
        </div>

        {/* Swapped Feed - Result from AKOOL */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-200">Face Swapped Result</h2>
            <span className={`px-3 py-1 rounded-full text-sm ${
              swappedUser
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {swappedUser ? 'Live' : 'Waiting...'}
            </span>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-2 relative">
            {swappedUser ? (
              <MediaPlayer
                videoTrack={swappedUser.videoTrack}
                audioTrack={swappedUser.audioTrack}
                className="rounded-xl bg-black/50"
              />
            ) : (
              <div className="aspect-video rounded-xl bg-black/50 flex items-center justify-center text-gray-500">
                {isSwapping ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin" size={40} />
                    <span className="text-sm">Processing face swap...</span>
                    <span className="text-xs text-gray-600">This may take a few seconds</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span>Stream not started</span>
                    <span className="text-xs text-gray-600">Click "Start Face Swap" to begin</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug info */}
      {akoolSession && (
        <div className="text-xs text-gray-600 bg-gray-800/30 px-4 py-2 rounded-lg">
          Session ID: {akoolSession.sessionId} |
          Channel: {akoolSession.agora.channelId} |
          Remote users: {remoteUsers.length}
        </div>
      )}

      <div className="flex gap-4 mt-8">
        {!localVideoTrack ? (
          <button
            onClick={startCamera}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
          >
            <Camera size={20} />
            Start Camera
          </button>
        ) : !isStreaming ? (
          <button
            onClick={startSwapSession}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors"
          >
            <Play size={20} />
            Start Face Swap
          </button>
        ) : (
          <button
            onClick={stopSwapSession}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors"
          >
            <Square size={20} />
            Stop Session
          </button>
        )}

        {localVideoTrack && !isStreaming && (
          <button
            onClick={stopCamera}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
          >
            Stop Camera
          </button>
        )}
      </div>
    </div>
  );
}
