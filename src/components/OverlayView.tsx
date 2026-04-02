import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { PoseData } from '../types/pose';
import type { PoseFrame } from '../types/pose';
import { POSE_CONNECTIONS } from '../types/pose';
import {
  computeAverageBoneLengths,
  computeStandardBoneLengths,
  retargetFrame,
  type BoneLengthMap,
} from '../lib/skeletonNormalize';

interface OverlayViewProps {
  refPose: PoseData;
  userPose: PoseData;
  refStartTime: number;
  userStartTime: number;
  refVideoUrl: string | null;
  userVideoUrl: string | null;
}

const CANVAS_W = 600;
const CANVAS_H = 600;

// Normalize a frame: center on hip midpoint, scale to fit canvas
function normalizeFrame(frame: PoseFrame): PoseFrame {
  if (frame.length === 0) return frame;

  const lh = frame[23], rh = frame[24];
  const ls = frame[11], rs = frame[12];
  if (!lh || !rh || !ls || !rs) return frame;

  // Center on hip midpoint
  const cx = (lh.x + rh.x) / 2;
  const cy = (lh.y + rh.y) / 2;

  // Scale based on shoulder-to-hip distance
  const sx = (ls.x + rs.x) / 2 - cx;
  const sy = (ls.y + rs.y) / 2 - cy;
  const bodyScale = Math.sqrt(sx * sx + sy * sy) || 1;

  // Normalize to ~0.3 of canvas (so body fits nicely)
  const targetScale = 0.3;
  const scale = targetScale / bodyScale;

  return frame.map((lm) => ({
    x: 0.5 + (lm.x - cx) * scale,
    y: 0.5 + (lm.y - cy) * scale,
    z: lm.z,
    visibility: lm.visibility,
  }));
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  color: string,
  lineWidth: number,
  dotSize: number,
  w: number,
  h: number,
  alpha: number = 1
) {
  if (frame.length === 0) return;
  ctx.globalAlpha = alpha;

  // Draw connections
  for (const [i, j] of POSE_CONNECTIONS) {
    if (!frame[i] || !frame[j]) continue;
    if (frame[i].visibility < 0.3 || frame[j].visibility < 0.3) continue;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(frame[i].x * w, frame[i].y * h);
    ctx.lineTo(frame[j].x * w, frame[j].y * h);
    ctx.stroke();
  }

  // Draw joints
  for (let i = 11; i < frame.length; i++) {
    const lm = frame[i];
    if (!lm || lm.visibility < 0.3) continue;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, dotSize, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// Draw diff highlights between two normalized frames
function drawDiffHighlights(
  ctx: CanvasRenderingContext2D,
  refFrame: PoseFrame,
  userFrame: PoseFrame,
  w: number,
  h: number,
  threshold: number = 0.03
) {
  if (refFrame.length === 0 || userFrame.length === 0) return;

  ctx.globalAlpha = 0.4;
  for (let i = 11; i < Math.min(refFrame.length, userFrame.length); i++) {
    const r = refFrame[i], u = userFrame[i];
    if (!r || !u || r.visibility < 0.3 || u.visibility < 0.3) continue;

    const dx = r.x - u.x;
    const dy = r.y - u.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > threshold) {
      // Draw a line connecting the same joint between ref and user
      ctx.strokeStyle = '#ff2d78';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(r.x * w, r.y * h);
      ctx.lineTo(u.x * w, u.y * h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw circles highlighting the difference
      const radius = Math.min(dist * w * 0.5, 20);
      ctx.fillStyle = 'rgba(255, 45, 120, 0.15)';
      ctx.beginPath();
      ctx.arc(u.x * w, u.y * h, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

const SPEED_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1.0];

export default function OverlayView({
  refPose,
  userPose,
  refStartTime,
  userStartTime,
  refVideoUrl,
  userVideoUrl,
}: OverlayViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [showRef, setShowRef] = useState(true);
  const [showUser, setShowUser] = useState(true);
  const [offsetFrames, setOffsetFrames] = useState(0); // frame offset for user

  const totalFrames = Math.min(refPose.frames.length, userPose.frames.length);

  // Compute standard bone lengths (average of ref and user) for proportion normalization
  const standardBones = useMemo<BoneLengthMap>(() => {
    const refBones = computeAverageBoneLengths(refPose.frames);
    const userBones = computeAverageBoneLengths(userPose.frames);
    return computeStandardBoneLengths(refBones, userBones);
  }, [refPose, userPose]);

  // Draw current frame
  const drawFrame = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    const safeIdx = Math.min(idx, totalFrames - 1);
    const refFrame = refPose.frames[safeIdx] || [];
    const userIdx = Math.max(0, Math.min(safeIdx + offsetFrames, userPose.frames.length - 1));
    const userFrame = userPose.frames[userIdx] || [];

    // Retarget bone lengths to standard proportions, then normalize position/scale
    const normRef = normalizeFrame(retargetFrame(refFrame, standardBones));
    const normUser = normalizeFrame(retargetFrame(userFrame, standardBones));

    // Draw diff highlights first (below skeletons)
    if (showRef && showUser) {
      drawDiffHighlights(ctx, normRef, normUser, CANVAS_W, CANVAS_H);
    }

    // Draw ref skeleton
    if (showRef) {
      drawSkeleton(ctx, normRef, '#00ff88', 3, 5, CANVAS_W, CANVAS_H, 0.8);
    }

    // Draw user skeleton
    if (showUser) {
      drawSkeleton(ctx, normUser, '#00d4ff', 3, 5, CANVAS_W, CANVAS_H, 0.8);
    }

    // Time display
    const time = safeIdx / refPose.fps;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px monospace';
    ctx.fillText(
      `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')} | Frame ${safeIdx}/${totalFrames}`,
      10, CANVAS_H - 10
    );
  }, [refPose, userPose, totalFrames, showRef, showUser, offsetFrames, standardBones]);

  // Animation loop synced to hidden video playback
  const animate = useCallback(() => {
    const refVideo = refVideoRef.current;
    if (refVideo) {
      const relTime = refVideo.currentTime - refStartTime;
      const fi = Math.max(0, Math.min(Math.floor(relTime * refPose.fps), totalFrames - 1));
      setFrameIdx(fi);
      drawFrame(fi);
    }

    if (isPlaying) {
      animRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying, refStartTime, refPose.fps, totalFrames, drawFrame]);

  useEffect(() => {
    if (isPlaying) {
      animRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, animate]);

  // Apply playback speed to videos whenever it changes
  useEffect(() => {
    if (refVideoRef.current) refVideoRef.current.playbackRate = speed;
    if (userVideoRef.current) userVideoRef.current.playbackRate = speed;
  }, [speed]);

  // Draw initial frame
  useEffect(() => {
    drawFrame(frameIdx);
  }, [drawFrame, frameIdx, showRef, showUser]);

  const togglePlay = useCallback(() => {
    const refVideo = refVideoRef.current;
    const userVideo = userVideoRef.current;
    if (!refVideo || !userVideo) return;

    if (isPlaying) {
      refVideo.pause();
      userVideo.pause();
      setIsPlaying(false);
    } else {
      refVideo.currentTime = refStartTime + frameIdx / refPose.fps;
      userVideo.currentTime = userStartTime + frameIdx / userPose.fps;
      refVideo.playbackRate = speed;
      userVideo.playbackRate = speed;
      refVideo.play();
      userVideo.play();
      setIsPlaying(true);
    }
  }, [isPlaying, speed, frameIdx, refStartTime, userStartTime, refPose.fps, userPose.fps]);

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setFrameIdx(val);
    drawFrame(val);
    // Sync hidden videos
    if (refVideoRef.current) refVideoRef.current.currentTime = refStartTime + val / refPose.fps;
    if (userVideoRef.current) userVideoRef.current.currentTime = userStartTime + val / userPose.fps;
  }, [drawFrame, refStartTime, userStartTime, refPose.fps, userPose.fps]);

  useEffect(() => {
    const refVideo = refVideoRef.current;
    if (!refVideo) return;
    const onEnded = () => {
      setIsPlaying(false);
      userVideoRef.current?.pause();
    };
    refVideo.addEventListener('ended', onEnded);
    return () => refVideo.removeEventListener('ended', onEnded);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs font-bold tracking-[0.15em] text-neon-purple mb-1">SKELETON OVERLAY</div>

      {/* Hidden videos for audio sync */}
      <video ref={refVideoRef} src={refVideoUrl || undefined} className="hidden" playsInline muted />
      <video ref={userVideoRef} src={userVideoUrl || undefined} className="hidden" playsInline muted />

      {/* Canvas */}
      <div className="flex justify-center">
        <div className="relative rounded-xl overflow-hidden border border-dark-600 glow-purple">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block"
            style={{ width: '100%', maxWidth: CANVAS_W }}
          />
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="px-2">
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={frameIdx}
          onChange={handleSlider}
          className="w-full accent-neon-purple h-1"
        />
      </div>

      {/* Controls */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 flex flex-col gap-3">
        {/* Toggle layers */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowRef(!showRef)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider border transition-all ${
              showRef
                ? 'bg-neon-green/20 text-neon-green border-neon-green/50'
                : 'bg-dark-700 text-dark-500 border-dark-600'
            }`}
          >
            {showRef ? 'ON' : 'OFF'} お手本
          </button>
          <button
            onClick={() => setShowUser(!showUser)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider border transition-all ${
              showUser
                ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/50'
                : 'bg-dark-700 text-dark-500 border-dark-600'
            }`}
          >
            {showUser ? 'ON' : 'OFF'} あなた
          </button>
        </div>

        {/* Sync offset */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold tracking-[0.15em] text-dark-500">SYNC OFFSET</span>
            <span className="text-[10px] text-gray-400 font-mono">
              {offsetFrames > 0 ? '+' : ''}{offsetFrames}f ({(offsetFrames / refPose.fps).toFixed(1)}s)
            </span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={offsetFrames}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setOffsetFrames(v);
              drawFrame(frameIdx);
            }}
            className="w-full accent-neon-purple h-1"
          />
          <div className="flex justify-between text-[10px] text-dark-500 mt-0.5">
            <span>お手本が先</span>
            <button
              onClick={() => { setOffsetFrames(0); drawFrame(frameIdx); }}
              className="text-neon-purple hover:text-neon-pink transition-colors"
            >
              RESET
            </button>
            <span>あなたが先</span>
          </div>
        </div>

        {/* Speed */}
        <div className="flex gap-2">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-all ${
                speed === s
                  ? 'bg-neon-purple/30 text-neon-purple border border-neon-purple/50'
                  : 'bg-dark-700 text-dark-500 border border-dark-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Play button */}
      <div className="flex justify-center">
        <button
          onClick={togglePlay}
          className={`px-8 py-3 rounded-xl font-bold text-sm tracking-wider transition-all ${
            isPlaying
              ? 'bg-dark-600 text-gray-300 border border-dark-500'
              : 'bg-gradient-to-r from-neon-purple to-neon-pink text-white glow-purple hover:scale-105 active:scale-95'
          }`}
        >
          {isPlaying ? 'PAUSE' : 'OVERLAY PLAY'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 text-[10px] tracking-wider">
        <span className="text-neon-green">GREEN = お手本</span>
        <span className="text-neon-blue">BLUE = あなた</span>
        <span className="text-neon-pink">PINK = ズレ</span>
      </div>
    </div>
  );
}
