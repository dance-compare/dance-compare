import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import PoseOverlay from './PoseOverlay';
import type { PoseData, PoseFrame, ComparisonResult } from '../types/pose';

interface VideoPlayerProps {
  refVideoUrl: string | null;
  userVideoUrl: string | null;
  refPose: PoseData;
  userPose: PoseData;
  result: ComparisonResult;
  refStartTime: number;
  userStartTime: number;
}

const SPEED_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1.0];

export default function VideoPlayer({
  refVideoUrl,
  userVideoUrl,
  refPose,
  userPose,
  result,
  refStartTime,
  userStartTime,
}: VideoPlayerProps) {
  const refVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef<number>(0);

  const [refFrameIdx, setRefFrameIdx] = useState(0);
  const [userFrameIdx, setUserFrameIdx] = useState(0);
  const [userOffset, setUserOffset] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const [refDim, setRefDim] = useState({ w: 640, h: 480 });
  const [userDim, setUserDim] = useState({ w: 640, h: 480 });

  const updateDimensions = useCallback(() => {
    const rv = refVideoRef.current;
    if (rv && rv.videoWidth) setRefDim({ w: rv.videoWidth, h: rv.videoHeight });
    const uv = userVideoRef.current;
    if (uv && uv.videoWidth) setUserDim({ w: uv.videoWidth, h: uv.videoHeight });
  }, []);

  // Auto-zoom: compute scale factors so both people appear the same size
  const { refZoom, userZoom } = useMemo(() => {
    function computeBodyFraction(frames: PoseFrame[]): number {
      let totalHeight = 0;
      let count = 0;
      for (const frame of frames) {
        if (frame.length === 0) continue;
        const ls = frame[11], rs = frame[12]; // shoulders
        const la = frame[27], ra = frame[28]; // ankles
        if (!ls || !rs || !la || !ra) continue;
        if (ls.visibility < 0.3 || rs.visibility < 0.3) continue;
        const topY = Math.min(ls.y, rs.y);
        const bottomY = Math.max(la.y, ra.y);
        const h = bottomY - topY;
        if (h > 0.05) { // sanity check
          totalHeight += h;
          count++;
        }
      }
      return count > 0 ? totalHeight / count : 0.5;
    }

    const refFrac = computeBodyFraction(refPose.frames);
    const userFrac = computeBodyFraction(userPose.frames);

    if (refFrac <= 0 || userFrac <= 0) return { refZoom: 1, userZoom: 1 };

    // Target: average of both fractions
    const target = (refFrac + userFrac) / 2;
    // Clamp zoom to reasonable range (0.5x to 2.0x)
    const rz = Math.max(0.5, Math.min(2.0, target / refFrac));
    const uz = Math.max(0.5, Math.min(2.0, target / userFrac));

    return { refZoom: rz, userZoom: uz };
  }, [refPose, userPose]);

  // Apply playback speed
  useEffect(() => {
    if (refVideoRef.current) refVideoRef.current.playbackRate = playbackSpeed;
    if (userVideoRef.current) userVideoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Animation loop: map video currentTime to pose frame index
  const updateOverlay = useCallback(() => {
    const refVideo = refVideoRef.current;
    const userVideo = userVideoRef.current;

    if (refVideo) {
      // Time relative to dance start
      const relTime = refVideo.currentTime - refStartTime;
      const fi = Math.min(
        Math.max(0, Math.floor(relTime * refPose.fps)),
        refPose.frames.length - 1
      );
      setRefFrameIdx(fi);
    }

    if (userVideo) {
      const relTime = userVideo.currentTime - userStartTime;
      const fi = Math.min(
        Math.max(0, Math.floor(relTime * userPose.fps)),
        userPose.frames.length - 1
      );
      setUserFrameIdx(fi);
    }

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updateOverlay);
    }
  }, [isPlaying, refPose, userPose, refStartTime, userStartTime]);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updateOverlay);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, updateOverlay]);

  const togglePlay = useCallback(() => {
    const refVideo = refVideoRef.current;
    const userVideo = userVideoRef.current;
    if (!refVideo || !userVideo) return;

    if (isPlaying) {
      refVideo.pause();
      userVideo.pause();
      setIsPlaying(false);
    } else {
      // Set start positions with offset
      refVideo.currentTime = refStartTime + (userOffset < 0 ? Math.abs(userOffset) : 0);
      userVideo.currentTime = userStartTime + (userOffset > 0 ? userOffset : 0);

      refVideo.playbackRate = playbackSpeed;
      userVideo.playbackRate = playbackSpeed;

      const playBoth = async () => {
        try {
          await Promise.all([refVideo.play(), userVideo.play()]);
          setIsPlaying(true);
        } catch (err) {
          console.warn('Play failed:', err);
        }
      };
      playBoth();
    }
  }, [isPlaying, userOffset, playbackSpeed, refStartTime, userStartTime]);

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

  const resetVideos = useCallback(() => {
    if (refVideoRef.current) { refVideoRef.current.pause(); refVideoRef.current.currentTime = refStartTime; }
    if (userVideoRef.current) { userVideoRef.current.pause(); userVideoRef.current.currentTime = userStartTime; }
    setRefFrameIdx(0);
    setUserFrameIdx(0);
    setIsPlaying(false);
  }, [refStartTime, userStartTime]);

  // Find the aligned reference frame for the current user frame (for diff display)
  const getAlignedRefFrameForUser = (): number | undefined => {
    // Find the closest pair in the DTW alignment
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < result.alignedUserFrames.length; i++) {
      const d = Math.abs(result.alignedUserFrames[i] - userFrameIdx);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestDist <= 3) {
      return result.alignedRefFrames[bestIdx];
    }
    // Fallback: same frame index
    return Math.min(refFrameIdx, refPose.frames.length - 1);
  };

  const alignedRefForUser = getAlignedRefFrameForUser();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Reference video */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-[0.15em] text-neon-green">REFERENCE</span>
            <span className="text-[11px] font-mono text-gray-400">
              {Math.floor(refFrameIdx / refPose.fps / 60)}:{String(Math.floor(refFrameIdx / refPose.fps % 60)).padStart(2, '0')}
              <span className="text-dark-500"> / {Math.floor(refPose.duration / 60)}:{String(Math.floor(refPose.duration % 60)).padStart(2, '0')}</span>
            </span>
          </div>
          <div
            className="relative rounded-xl overflow-hidden bg-black border border-dark-600"
            style={{ aspectRatio: '16 / 9' }}
          >
            <video
              ref={refVideoRef}
              src={refVideoUrl || undefined}
              className="w-full h-full object-contain"
              style={{ transform: `scale(${refZoom})`, transformOrigin: 'center center' }}
              playsInline
              onLoadedMetadata={updateDimensions}
            />
            <PoseOverlay
              poseFrame={refPose.frames[refFrameIdx]}
              color="#00ff88"
              width={refDim.w}
              height={refDim.h}
              zoom={refZoom}
            />
          </div>
        </div>

        {/* User video */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-[0.15em] text-neon-blue">YOUR DANCE</span>
            <span className="text-[11px] font-mono text-gray-400">
              {Math.floor(userFrameIdx / userPose.fps / 60)}:{String(Math.floor(userFrameIdx / userPose.fps % 60)).padStart(2, '0')}
              <span className="text-dark-500"> / {Math.floor(userPose.duration / 60)}:{String(Math.floor(userPose.duration % 60)).padStart(2, '0')}</span>
            </span>
          </div>
          <div
            className="relative rounded-xl overflow-hidden bg-black border border-dark-600"
            style={{ aspectRatio: '16 / 9' }}
          >
            <video
              ref={userVideoRef}
              src={userVideoUrl || undefined}
              className="w-full h-full object-contain"
              style={{ transform: `scale(${userZoom})`, transformOrigin: 'center center' }}
              playsInline
              onLoadedMetadata={updateDimensions}
            />
            <PoseOverlay
              poseFrame={userPose.frames[userFrameIdx]}
              diffFrame={alignedRefForUser !== undefined ? refPose.frames[alignedRefForUser] : undefined}
              color="#00d4ff"
              width={userDim.w}
              height={userDim.h}
              zoom={userZoom}
            />
          </div>
        </div>
      </div>

      {/* Controls panel */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
        {/* Speed control */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-[0.15em] text-dark-500">SPEED</span>
            <span className="text-xs text-gray-400 font-mono">{playbackSpeed}x</span>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`flex-1 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wider transition-all ${
                  playbackSpeed === speed
                    ? 'bg-neon-purple/30 text-neon-purple border border-neon-purple/50'
                    : 'bg-dark-700 text-dark-500 border border-dark-600 hover:text-gray-300 hover:border-dark-500'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Offset slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-[0.15em] text-dark-500">SYNC OFFSET</span>
            <span className="text-xs text-gray-400 font-mono">
              {userOffset > 0 ? '+' : ''}{userOffset.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min={-5}
            max={5}
            step={0.1}
            value={userOffset}
            onChange={(e) => setUserOffset(parseFloat(e.target.value))}
            className="w-full accent-neon-purple h-1"
          />
          <div className="flex justify-between text-[10px] text-dark-500 mt-1">
            <span>お手本が先 -5s</span>
            <button
              onClick={() => setUserOffset(0)}
              className="text-neon-purple hover:text-neon-pink transition-colors"
            >
              RESET
            </button>
            <span>あなたが先 +5s</span>
          </div>
        </div>
      </div>

      {/* Playback buttons */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-3">
          <button
            onClick={resetVideos}
            className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wider bg-dark-600 text-gray-400 border border-dark-500 hover:border-neon-blue/50 hover:text-neon-blue transition-all"
          >
            RESET
          </button>
          <button
            onClick={togglePlay}
            className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wider transition-all ${
              isPlaying
                ? 'bg-dark-600 text-gray-300 border border-dark-500 hover:border-neon-pink/50'
                : 'bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95'
            }`}
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 text-[10px] tracking-wider">
          <span className="text-neon-green">GREEN = お手本</span>
          <span className="text-neon-blue">BLUE = あなた</span>
          <span className="text-neon-pink">PINK = ズレが大きい部分</span>
        </div>
      </div>
    </div>
  );
}
