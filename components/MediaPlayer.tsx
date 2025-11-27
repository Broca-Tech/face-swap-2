import { ILocalVideoTrack, IRemoteVideoTrack, ILocalAudioTrack, IRemoteAudioTrack } from "agora-rtc-sdk-ng";
import React, { useRef, useEffect } from "react";

export interface VideoPlayerProps {
  videoTrack: ILocalVideoTrack | IRemoteVideoTrack | undefined;
  audioTrack: ILocalAudioTrack | IRemoteAudioTrack | undefined;
  className?: string;
}

const MediaPlayer = ({ videoTrack, audioTrack, className }: VideoPlayerProps) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) {
      console.log('MediaPlayer: container not ready');
      return;
    }
    if (videoTrack) {
      console.log('MediaPlayer: playing video track', videoTrack);
      videoTrack.play(container.current);
    }
    return () => {
      if (videoTrack) {
        console.log('MediaPlayer: stopping video track');
        videoTrack.stop();
      }
    };
  }, [videoTrack]);

  useEffect(() => {
    audioTrack?.play();
    return () => {
      audioTrack?.stop();
    };
  }, [audioTrack]);

  return (
    <div
      ref={container}
      className={`aspect-video w-full ${className || ""}`}
      style={{
        minHeight: '240px',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#1a1a2e', // Debug: visible background
      }}
    />
  );
};

export default MediaPlayer;
