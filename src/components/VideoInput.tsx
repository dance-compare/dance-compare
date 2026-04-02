import { useRef, useState, useCallback, useEffect } from 'react';
import CameraRecorder from './CameraRecorder';

interface VideoInputProps {
  label: string;
  sublabel: string;
  accentColor: 'green' | 'blue';
  onVideoReady: (url: string) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

type InputMode = 'upload' | 'camera';

const accents = {
  green: {
    border: 'border-neon-green/30',
    hoverBorder: 'hover:border-neon-green/60',
    text: 'text-neon-green',
    glow: 'glow-green',
    bg: 'from-neon-green/10 to-transparent',
    activeTab: 'bg-neon-green/20 text-neon-green border-neon-green/50',
    icon: 'text-neon-green',
  },
  blue: {
    border: 'border-neon-blue/30',
    hoverBorder: 'hover:border-neon-blue/60',
    text: 'text-neon-blue',
    glow: 'glow-blue',
    bg: 'from-neon-blue/10 to-transparent',
    activeTab: 'bg-neon-blue/20 text-neon-blue border-neon-blue/50',
    icon: 'text-neon-blue',
  },
};

export default function VideoInput({ label, sublabel, accentColor, onVideoReady, videoRef }: VideoInputProps) {
  const [mode, setMode] = useState<InputMode>('upload');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showSparkle, setShowSparkle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const a = accents[accentColor];

  const sparkleColor = accentColor === 'green'
    ? { main: '#00ff88', sub: '#00d4ff', third: '#ffe600', glow: 'rgba(0,255,136,0.5)', cardGlow: 'rgba(0,255,136,0.5)' }
    : { main: '#00d4ff', sub: '#b83dfa', third: '#ff2d78', glow: 'rgba(0,212,255,0.5)', cardGlow: 'rgba(0,212,255,0.5)' };

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleRecorded = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setVideoUrl(url);
  }, []);

  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current && videoUrl) {
      onVideoReady(videoUrl);
      setShowSparkle(true);
    }
  }, [onVideoReady, videoRef, videoUrl]);

  // Auto-hide sparkle after animation completes
  useEffect(() => {
    if (!showSparkle) return;
    const timer = setTimeout(() => setShowSparkle(false), 2500);
    return () => clearTimeout(timer);
  }, [showSparkle]);

  const clearVideo = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
  }, [videoUrl]);

  return (
    <div
      className={`flex flex-col gap-3 flex-1 min-w-0 rounded-2xl bg-dark-800 border ${a.border} p-4 ${showSparkle ? 'animate-sparkle-card-glow animate-sparkle-scale-bounce' : ''}`}
      style={showSparkle ? { '--sparkle-color': sparkleColor.cardGlow } as React.CSSProperties : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-xs font-bold tracking-[0.2em] ${a.text}`}>{label}</h3>
          <p className="text-sm text-gray-400">{sublabel}</p>
        </div>
        {videoUrl && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${a.activeTab}`}>
            READY
          </span>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('upload'); clearVideo(); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            mode === 'upload' ? a.activeTab : 'border-dark-600 text-dark-500 hover:text-gray-300 hover:border-dark-500'
          }`}
        >
          Upload
        </button>
        <button
          onClick={() => { setMode('camera'); clearVideo(); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            mode === 'camera' ? a.activeTab : 'border-dark-600 text-dark-500 hover:text-gray-300 hover:border-dark-500'
          }`}
        >
          Camera
        </button>
      </div>

      {/* Video display */}
      {videoUrl ? (
        <div className="relative group">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            onLoadedMetadata={handleVideoLoaded}
            className={`w-full rounded-xl bg-black border ${a.border}`}
            crossOrigin="anonymous"
          />
          <button
            onClick={clearVideo}
            className="absolute top-2 right-2 bg-dark-800/80 backdrop-blur text-gray-400 rounded-full w-7 h-7 flex items-center justify-center text-sm hover:text-neon-pink hover:bg-dark-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            x
          </button>

          {/* ✨ Stage entrance sparkle effect — FLASHY */}
          {showSparkle && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-10">
              {/* Big white flash */}
              <div
                className="absolute inset-0 animate-sparkle-flash"
                style={{ background: `radial-gradient(ellipse at center, rgba(255,255,255,0.7) 0%, ${sparkleColor.glow} 40%, transparent 75%)` }}
              />
              {/* Secondary colored flash */}
              <div
                className="absolute inset-0 animate-sparkle-flash"
                style={{ background: `radial-gradient(ellipse at center, ${sparkleColor.glow} 0%, transparent 60%)`, animationDelay: '0.2s' }}
              />

              {/* Multiple expanding rings */}
              {[
                { size: 'w-24 h-24 sm:w-40 sm:h-40', color: sparkleColor.main, delay: '0s', width: '4px' },
                { size: 'w-20 h-20 sm:w-32 sm:h-32', color: sparkleColor.sub, delay: '0.12s', width: '3px' },
                { size: 'w-28 h-28 sm:w-48 sm:h-48', color: sparkleColor.third, delay: '0.25s', width: '2px' },
                { size: 'w-16 h-16 sm:w-24 sm:h-24', color: sparkleColor.main, delay: '0.35s', width: '3px' },
              ].map((ring, i) => (
                <div
                  key={`ring-${i}`}
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${ring.size} rounded-full animate-sparkle-ring`}
                  style={{ border: `${ring.width} solid ${ring.color}`, animationDelay: ring.delay }}
                />
              ))}

              {/* Center star burst — big */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl sm:text-6xl animate-sparkle-star"
                style={{ color: sparkleColor.main, filter: `drop-shadow(0 0 12px ${sparkleColor.main})` }}
              >
                ✦
              </div>
              {/* Second star slightly delayed */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl animate-sparkle-star"
                style={{ color: sparkleColor.sub, animationDelay: '0.15s', filter: `drop-shadow(0 0 8px ${sparkleColor.sub})` }}
              >
                ✦
              </div>

              {/* Sparkle particles — lots of them flying outward */}
              {[
                { x: '50%', y: '50%', tx: '-120px', ty: '-90px', delay: '0s', size: '18px' },
                { x: '50%', y: '50%', tx: '110px', ty: '-70px', delay: '0.05s', size: '16px' },
                { x: '50%', y: '50%', tx: '130px', ty: '40px', delay: '0.1s', size: '14px' },
                { x: '50%', y: '50%', tx: '-100px', ty: '80px', delay: '0.08s', size: '16px' },
                { x: '50%', y: '50%', tx: '20px', ty: '-120px', delay: '0.12s', size: '20px' },
                { x: '50%', y: '50%', tx: '-40px', ty: '110px', delay: '0.15s', size: '14px' },
                { x: '50%', y: '50%', tx: '90px', ty: '90px', delay: '0.18s', size: '12px' },
                { x: '50%', y: '50%', tx: '-130px', ty: '10px', delay: '0.06s', size: '15px' },
                { x: '50%', y: '50%', tx: '60px', ty: '-110px', delay: '0.2s', size: '13px' },
                { x: '50%', y: '50%', tx: '-70px', ty: '-120px', delay: '0.22s', size: '11px' },
                { x: '50%', y: '50%', tx: '140px', ty: '-20px', delay: '0.14s', size: '17px' },
                { x: '50%', y: '50%', tx: '-50px', ty: '130px', delay: '0.25s', size: '12px' },
              ].map((p, i) => (
                <div
                  key={`particle-${i}`}
                  className="absolute animate-sparkle-fly"
                  style={{
                    left: p.x,
                    top: p.y,
                    fontSize: p.size,
                    animationDelay: p.delay,
                    color: [sparkleColor.main, sparkleColor.sub, sparkleColor.third][i % 3],
                    filter: `drop-shadow(0 0 6px ${[sparkleColor.main, sparkleColor.sub, sparkleColor.third][i % 3]})`,
                    '--fly-tx': p.tx,
                    '--fly-ty': p.ty,
                  } as React.CSSProperties}
                >
                  {['✦', '✧', '⬦', '✦', '◇', '✧'][i % 6]}
                </div>
              ))}

              {/* Horizontal light sweep */}
              <div
                className="absolute top-1/2 left-0 w-full h-[3px] animate-sparkle-sweep"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${sparkleColor.main} 30%, white 50%, ${sparkleColor.sub} 70%, transparent 100%)`,
                  filter: `blur(1px) drop-shadow(0 0 8px ${sparkleColor.main})`,
                }}
              />
              {/* Second sweep, slightly offset */}
              <div
                className="absolute top-[45%] left-0 w-full h-[2px] animate-sparkle-sweep"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${sparkleColor.sub} 30%, white 50%, ${sparkleColor.third} 70%, transparent 100%)`,
                  animationDelay: '0.15s',
                  filter: `blur(1px)`,
                }}
              />

              {/* Corner sparkles */}
              {[
                { pos: 'top-3 left-3', delay: '0.3s' },
                { pos: 'top-3 right-3', delay: '0.4s' },
                { pos: 'bottom-3 left-3', delay: '0.5s' },
                { pos: 'bottom-3 right-3', delay: '0.45s' },
              ].map((c, i) => (
                <div
                  key={`corner-${i}`}
                  className={`absolute ${c.pos} text-xl animate-sparkle-star`}
                  style={{
                    animationDelay: c.delay,
                    color: sparkleColor.main,
                    filter: `drop-shadow(0 0 8px ${sparkleColor.main})`,
                  }}
                >
                  ✦
                </div>
              ))}
            </div>
          )}
        </div>
      ) : mode === 'upload' ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed border-dark-500 rounded-xl p-5 sm:p-8 text-center cursor-pointer ${a.hoverBorder} hover:bg-gradient-to-b ${a.bg} transition-all min-h-[130px] sm:min-h-[180px] flex flex-col items-center justify-center gap-2 sm:gap-3`}
        >
          <div className={`text-3xl ${a.icon}`}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-gray-400 text-sm">ドラッグ&ドロップ</p>
            <p className="text-dark-500 text-xs mt-1">またはクリックで選択</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <CameraRecorder onRecorded={handleRecorded} />
      )}
    </div>
  );
}
