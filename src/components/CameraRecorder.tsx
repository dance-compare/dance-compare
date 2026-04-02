import { useRef, useState, useCallback, useEffect } from 'react';

interface CameraRecorderProps {
  onRecorded: (blob: Blob) => void;
}

export default function CameraRecorder({ onRecorded }: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasStream, setHasStream] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasStream(true);
    } catch {
      alert('カメラへのアクセスが許可されませんでした。');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setHasStream(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      stopCamera();
      onRecorded(blob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }, [onRecorded, stopCamera]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full bg-black"
          style={{ transform: 'scaleX(-1)' }}
        />
        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-neon-pink animate-neon-pulse" />
            <span className="text-xs text-neon-pink font-bold tracking-wider">REC</span>
          </div>
        )}
      </div>
      {hasStream && (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm tracking-wider transition-all ${
            isRecording
              ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/50 glow-pink hover:bg-neon-pink/30'
              : 'bg-dark-600 text-gray-300 border border-dark-500 hover:border-neon-green/50 hover:text-neon-green'
          }`}
        >
          {isRecording ? 'STOP' : 'REC'}
        </button>
      )}
    </div>
  );
}
