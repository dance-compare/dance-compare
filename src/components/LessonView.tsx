import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { PoseData, PoseFrame, ComparisonResult } from '../types/pose';
import { POSE_CONNECTIONS, JOINT_ANGLES } from '../types/pose';

interface LessonViewProps {
  userPose: PoseData;
  refPose: PoseData;
  result: ComparisonResult;
  userVideoUrl: string | null;
  userStartTime: number;
}

// ── Level definitions ──
const LEVELS = [
  {
    id: 'beginner',
    name: 'STARTER',
    nameJa: '初級',
    icon: '🌱',
    threshold: 35,
    intervalSec: 3.0,
    desc: '大きくズレた箇所だけ指摘',
    color: 'neon-green',
  },
  {
    id: 'intermediate',
    name: 'RISING',
    nameJa: '中級',
    icon: '🔥',
    threshold: 55,
    intervalSec: 2.0,
    desc: '中程度のズレから指摘',
    color: 'neon-blue',
  },
  {
    id: 'advanced',
    name: 'MASTER',
    nameJa: '上級',
    icon: '⭐',
    threshold: 72,
    intervalSec: 1.2,
    desc: '小さなズレも指摘',
    color: 'neon-purple',
  },
  {
    id: 'pro',
    name: 'LEGEND',
    nameJa: 'プロ',
    icon: '👑',
    threshold: 88,
    intervalSec: 0.7,
    desc: 'わずかなズレも見逃さない',
    color: 'neon-pink',
  },
] as const;

// ── Advice types ──
interface AdviceMsg {
  main: string;
  sub: string;
}

// ── Direction-aware joint info ──
// Maps joint angle index → { name, side, child landmark for position check }
const JOINT_INFO: {
  nameJa: string;
  side: 'left' | 'right' | 'center';
  childIdx: number;    // the landmark to check direction for
  parentIdx: number;   // its parent joint
  type: 'elbow' | 'shoulder' | 'hip' | 'knee';
}[] = [
  { nameJa: '左肘',  side: 'left',  childIdx: 15, parentIdx: 13, type: 'elbow' },    // 0: leftElbow
  { nameJa: '右肘',  side: 'right', childIdx: 16, parentIdx: 14, type: 'elbow' },    // 1: rightElbow
  { nameJa: '左肩',  side: 'left',  childIdx: 13, parentIdx: 11, type: 'shoulder' },  // 2: leftShoulder
  { nameJa: '右肩',  side: 'right', childIdx: 14, parentIdx: 12, type: 'shoulder' },  // 3: rightShoulder
  { nameJa: '左股関節', side: 'left',  childIdx: 25, parentIdx: 23, type: 'hip' },    // 4: leftHip
  { nameJa: '右股関節', side: 'right', childIdx: 26, parentIdx: 24, type: 'hip' },    // 5: rightHip
  { nameJa: '左膝',  side: 'left',  childIdx: 27, parentIdx: 25, type: 'knee' },      // 6: leftKnee
  { nameJa: '右膝',  side: 'right', childIdx: 28, parentIdx: 26, type: 'knee' },      // 7: rightKnee
];

// Arrow character for direction
function dirArrow(dx: number, dy: number): string {
  const angle = Math.atan2(-dy, dx) * (180 / Math.PI); // -dy because screen Y is inverted
  if (angle > 60 && angle < 120) return '↑';
  if (angle > -120 && angle < -60) return '↓';
  if (angle > 150 || angle < -150) return '←';
  if (angle > -30 && angle < 30) return '→';
  if (angle >= 30 && angle <= 60) return '↗';
  if (angle >= 120 && angle <= 150) return '↖';
  if (angle >= -60 && angle <= -30) return '↘';
  return '↙';
}

// Generate direction description
function describeDirection(
  dx: number,
  dy: number,
  side: 'left' | 'right' | 'center',
  type: 'elbow' | 'shoulder' | 'hip' | 'knee'
): { dirText: string; arrow: string } {
  const arrow = dirArrow(dx, dy);
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Determine if user needs to move outward/inward
  const isOutward = side === 'left' ? dx < 0 : dx > 0;
  const isUp = dy < 0;

  // Predominant direction
  if (absDy > absDx * 1.5) {
    // Mostly vertical
    if (type === 'elbow' || type === 'shoulder') {
      return { dirText: isUp ? '上に伸ばす' : '下に下げる', arrow };
    }
    if (type === 'knee' || type === 'hip') {
      return { dirText: isUp ? '上に引き上げる' : '下に落とす', arrow };
    }
  } else if (absDx > absDy * 1.5) {
    // Mostly horizontal
    if (type === 'elbow' || type === 'shoulder') {
      return { dirText: isOutward ? '外側に開く' : '内側に寄せる', arrow };
    }
    if (type === 'hip' || type === 'knee') {
      return { dirText: isOutward ? '外側に広げる' : '内側に閉じる', arrow };
    }
  }

  // Diagonal — combine both
  const vPart = isUp ? '上' : '下';
  const hPart = isOutward ? '外側' : '内側';
  return { dirText: `${hPart}${vPart}に動かす`, arrow };
}

// Stylish main text based on direction & type
function stylishMain(
  type: 'elbow' | 'shoulder' | 'hip' | 'knee',
  isExtend: boolean,
  arrow: string
): string {
  const msgs: Record<string, string[]> = {
    elbow_extend: ['EXTEND ' + arrow, 'REACH OUT ' + arrow, 'LONG LINE ' + arrow],
    elbow_bend: ['BEND IT ' + arrow, 'SHARP ANGLE ' + arrow, 'SNAP ' + arrow],
    shoulder_extend: ['REACH ' + arrow, 'LIFT ' + arrow, 'OPEN UP ' + arrow],
    shoulder_bend: ['BRING IN ' + arrow, 'PULL BACK ' + arrow, 'TUCK ' + arrow],
    hip_extend: ['GO WIDE ' + arrow, 'OPEN ' + arrow, 'EXPAND ' + arrow],
    hip_bend: ['PULL IN ' + arrow, 'TIGHTEN ' + arrow, 'CONTROL ' + arrow],
    knee_extend: ['STAND TALL ' + arrow, 'RISE ' + arrow, 'STRAIGHTEN ' + arrow],
    knee_bend: ['DROP LOW ' + arrow, 'DEEP BEND ' + arrow, 'GROOVE ' + arrow],
  };
  const key = `${type}_${isExtend ? 'extend' : 'bend'}`;
  const pool = msgs[key] || ['MOVE ' + arrow];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Angle helpers ──
function angleBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number }
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magAB * magCB)))) * (180 / Math.PI);
}

function extractAngles(frame: PoseFrame): number[] {
  if (frame.length === 0) return new Array(JOINT_ANGLES.length).fill(0);
  return JOINT_ANGLES.map(({ joints: [a, b, c] }) => {
    if (!frame[a] || !frame[b] || !frame[c]) return 0;
    return angleBetween(frame[a], frame[b], frame[c]);
  });
}

// Highlight landmark pairs per joint angle index
const HIGHLIGHT_LANDMARKS: number[][] = [
  [13, 15], // leftElbow
  [14, 16], // rightElbow
  [11, 13], // leftShoulder
  [12, 14], // rightShoulder
  [23, 25], // leftHip
  [24, 26], // rightHip
  [25, 27], // leftKnee
  [26, 28], // rightKnee
];

// ── Lesson stop type ──
interface LessonStop {
  userFrameIdx: number;
  refFrameIdx: number;
  time: number;        // seconds
  score: number;
  advice: AdviceMsg;
  highlightLandmarks: number[];
  worstParts: string[];
}

// ── Map ref skeleton to user's coordinate space for ghost overlay ──
function mapRefToUserSpace(refFrame: PoseFrame, userFrame: PoseFrame): PoseFrame {
  if (refFrame.length === 0 || userFrame.length === 0) return refFrame;
  const uLH = userFrame[23], uRH = userFrame[24], uLS = userFrame[11], uRS = userFrame[12];
  const rLH = refFrame[23], rRH = refFrame[24], rLS = refFrame[11], rRS = refFrame[12];
  if (!uLH || !uRH || !uLS || !uRS || !rLH || !rRH || !rLS || !rRS) return refFrame;

  const uCx = (uLH.x + uRH.x) / 2;
  const uCy = (uLH.y + uRH.y) / 2;
  const uSx = (uLS.x + uRS.x) / 2 - uCx;
  const uSy = (uLS.y + uRS.y) / 2 - uCy;
  const uScale = Math.sqrt(uSx * uSx + uSy * uSy) || 1;

  const rCx = (rLH.x + rRH.x) / 2;
  const rCy = (rLH.y + rRH.y) / 2;
  const rSx = (rLS.x + rRS.x) / 2 - rCx;
  const rSy = (rLS.y + rRS.y) / 2 - rCy;
  const rScale = Math.sqrt(rSx * rSx + rSy * rSy) || 1;

  const scale = uScale / rScale;
  return refFrame.map((lm) => ({
    x: uCx + (lm.x - rCx) * scale,
    y: uCy + (lm.y - rCy) * scale,
    z: lm.z,
    visibility: lm.visibility,
  }));
}

// ── Analyze a specific frame pair and generate direction-aware advice ──
function analyzeFramePair(refFrame: PoseFrame, userFrame: PoseFrame): {
  advice: AdviceMsg;
  highlightLandmarks: number[];
} {
  if (refFrame.length === 0 || userFrame.length === 0) {
    return {
      advice: { main: 'FEEL THE BEAT! ♪', sub: 'リズムに乗って踊ろう' },
      highlightLandmarks: [],
    };
  }

  const refAngles = extractAngles(refFrame);
  const userAngles = extractAngles(userFrame);

  // Find the joint angle with the biggest difference
  let maxAbsDiff = 0;
  let maxIdx = 0;
  for (let i = 0; i < refAngles.length; i++) {
    if (refAngles[i] === 0 && userAngles[i] === 0) continue;
    const d = Math.abs(userAngles[i] - refAngles[i]);
    if (d > maxAbsDiff) {
      maxAbsDiff = d;
      maxIdx = i;
    }
  }

  const angleDiff = userAngles[maxIdx] - refAngles[maxIdx];
  const isExtend = angleDiff > 0; // user's angle is larger = more extended
  const joint = JOINT_INFO[maxIdx];

  // Compute spatial direction: where should the child landmark move?
  // Direction = ref position - user position (where to go)
  const userChild = userFrame[joint.childIdx];
  const refChild = refFrame[joint.childIdx];

  let dirText = isExtend ? '伸ばす' : '曲げる';
  let arrow = isExtend ? '→' : '←';

  if (userChild && refChild && userChild.visibility > 0.3 && refChild.visibility > 0.3) {
    // Normalize ref child to user's body space for fair comparison
    const uLH = userFrame[23], uRH = userFrame[24];
    const rLH = refFrame[23], rRH = refFrame[24];
    if (uLH && uRH && rLH && rRH) {
      const uCx = (uLH.x + uRH.x) / 2;
      const uCy = (uLH.y + uRH.y) / 2;
      const rCx = (rLH.x + rRH.x) / 2;
      const rCy = (rLH.y + rRH.y) / 2;

      // User child relative to user center
      const uRelX = userChild.x - uCx;
      const uRelY = userChild.y - uCy;
      // Ref child relative to ref center
      const rRelX = refChild.x - rCx;
      const rRelY = refChild.y - rCy;

      // Direction user needs to move = ref position - user position
      const dx = rRelX - uRelX;
      const dy = rRelY - uRelY;

      const result = describeDirection(dx, dy, joint.side, joint.type);
      dirText = result.dirText;
      arrow = result.arrow;
    }
  }

  const main = stylishMain(joint.type, isExtend, arrow);
  const sub = `${joint.nameJa}を${dirText} ${arrow}`;

  return {
    advice: { main, sub },
    highlightLandmarks: HIGHLIGHT_LANDMARKS[maxIdx],
  };
}

// ── Compute lesson stops ──
function computeLessonStops(
  result: ComparisonResult,
  threshold: number,
  intervalSec: number,
  refPose: PoseData,
  userPose: PoseData
): LessonStop[] {
  // frameDiffs already contains per-frame scores with frameIndex (ref) and time
  // We need to map ref frame → user frame via aligned arrays
  // Build a closest-match lookup since exact match may not exist
  const refToUser = new Map<number, number>();
  for (let i = 0; i < result.alignedRefFrames.length; i++) {
    refToUser.set(result.alignedRefFrames[i], result.alignedUserFrames[i]);
  }

  function findUserFrame(refIdx: number): number {
    // Try exact match first
    const exact = refToUser.get(refIdx);
    if (exact !== undefined) return exact;
    // Closest match
    let bestDist = Infinity;
    let bestUi = 0;
    for (let i = 0; i < result.alignedRefFrames.length; i++) {
      const d = Math.abs(result.alignedRefFrames[i] - refIdx);
      if (d < bestDist) {
        bestDist = d;
        bestUi = result.alignedUserFrames[i];
      }
    }
    return bestUi;
  }

  // Collect all frames below threshold
  const rawStops: {
    ri: number;
    ui: number;
    time: number;
    score: number;
    worstParts: string[];
  }[] = [];

  for (const fd of result.frameDiffs) {
    if (fd.score < threshold) {
      const ui = findUserFrame(fd.frameIndex);
      rawStops.push({
        ri: fd.frameIndex,
        ui,
        time: fd.time,
        score: fd.score,
        worstParts: fd.worstParts,
      });
    }
  }

  console.log(`Lesson stops: threshold=${threshold}, frameDiffs=${result.frameDiffs.length}, below threshold=${rawStops.length}`);

  if (rawStops.length === 0) return [];

  // Interval size varies by level: higher levels use shorter intervals for more granular feedback.
  const INTERVAL_SEC = intervalSec;
  const totalDuration = result.frameDiffs.length > 0
    ? result.frameDiffs[result.frameDiffs.length - 1].time
    : 0;
  const numIntervals = Math.max(1, Math.ceil(totalDuration / INTERVAL_SEC));

  const stops: LessonStop[] = [];

  for (let interval = 0; interval < numIntervals; interval++) {
    const tMin = interval * INTERVAL_SEC;
    const tMax = tMin + INTERVAL_SEC;

    const inInterval = rawStops.filter((s) => s.time >= tMin && s.time < tMax);
    if (inInterval.length === 0) continue;

    const worst = inInterval.reduce((a, b) => (a.score < b.score ? a : b));
    const refFrame = refPose.frames[worst.ri] || [];
    const userFrame = userPose.frames[worst.ui] || [];
    const analysis = analyzeFramePair(refFrame, userFrame);

    stops.push({
      userFrameIdx: worst.ui,
      refFrameIdx: worst.ri,
      time: worst.time,
      score: worst.score,
      advice: analysis.advice,
      highlightLandmarks: analysis.highlightLandmarks,
      worstParts: worst.worstParts,
    });
  }

  console.log(`Lesson stops: threshold=${threshold}, stops=${stops.length}`);
  return stops;
}

// ── Drawing helpers ──
function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  w: number,
  h: number,
  color: string,
  lineWidth: number,
  alpha: number,
  highlightLandmarks?: number[]
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

    const isHighlighted = highlightLandmarks?.includes(i);
    if (isHighlighted) {
      // Draw glow for highlighted joints
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ff2d78';
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 18, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    ctx.fillStyle = isHighlighted ? '#ff2d78' : color;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, isHighlighted ? 6 : 4, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// ── Component ──
type Phase = 'select' | 'playing' | 'paused' | 'complete';

export default function LessonView({
  userPose,
  refPose,
  result,
  userVideoUrl,
  userStartTime,
}: LessonViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>('select');
  const [levelIdx, setLevelIdx] = useState(0);
  const [currentStopIdx, setCurrentStopIdx] = useState(0);
  const [, setCurrentUserFrame] = useState(0);
  const [showAdvice, setShowAdvice] = useState(false);
  const [stopsCompleted, setStopsCompleted] = useState(0);

  const level = LEVELS[levelIdx];

  // Pre-compute lesson stops
  const stops = useMemo(
    () => computeLessonStops(result, level.threshold, level.intervalSec, refPose, userPose),
    [result, level.threshold, refPose, userPose]
  );

  // Get corresponding ref frame for current user frame
  const getRefFrameIdx = useCallback(
    (userIdx: number): number => {
      // Find closest aligned pair
      let bestDist = Infinity;
      let bestRefIdx = 0;
      for (let i = 0; i < result.alignedUserFrames.length; i++) {
        const d = Math.abs(result.alignedUserFrames[i] - userIdx);
        if (d < bestDist) {
          bestDist = d;
          bestRefIdx = result.alignedRefFrames[i];
        }
      }
      return bestRefIdx;
    },
    [result]
  );

  // Compute the actual video display area inside the object-contain container
  function getVideoRect(video: HTMLVideoElement, containerW: number, containerH: number) {
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const videoAspect = vw / vh;
    const containerAspect = containerW / containerH;

    let drawW: number, drawH: number, offsetX: number, offsetY: number;
    if (videoAspect > containerAspect) {
      // Video is wider — black bars top/bottom
      drawW = containerW;
      drawH = containerW / videoAspect;
      offsetX = 0;
      offsetY = (containerH - drawH) / 2;
    } else {
      // Video is taller — black bars left/right
      drawH = containerH;
      drawW = containerH * videoAspect;
      offsetX = (containerW - drawW) / 2;
      offsetY = 0;
    }
    return { drawW, drawH, offsetX, offsetY };
  }

  // Draw frame on canvas
  const drawFrame = useCallback(
    (userIdx: number, isPaused: boolean, highlightLandmarks?: number[]) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const video = videoRef.current;
      if (!canvas || !container || !video) return;

      const rect = container.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      canvas.width = cw * window.devicePixelRatio;
      canvas.height = ch * window.devicePixelRatio;
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.clearRect(0, 0, cw, ch);

      // Map skeleton to actual video display area (handles object-contain letterboxing)
      const { drawW: w, drawH: h, offsetX: ox, offsetY: oy } = getVideoRect(video, cw, ch);
      ctx.save();
      ctx.translate(ox, oy);

      const safeIdx = Math.max(0, Math.min(userIdx, userPose.frames.length - 1));
      const userFrame = userPose.frames[safeIdx] || [];

      // Always draw user skeleton on the body (thick, visible)
      drawSkeleton(ctx, userFrame, w, h, '#00d4ff', 4, 0.85);

      if (isPaused) {
        // Dim overlay — cover full canvas including letterbox bars
        ctx.restore();
        ctx.fillStyle = 'rgba(10, 10, 15, 0.35)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.save();
        ctx.translate(ox, oy);

        // Redraw user skeleton on top of dim (so it stays crisp)
        drawSkeleton(ctx, userFrame, w, h, '#00d4ff', 4, 0.9, highlightLandmarks);

        // Draw ref ghost skeleton — "this is where you should be"
        const refIdx = getRefFrameIdx(safeIdx);
        const refFrame = refPose.frames[refIdx] || [];
        const mappedRef = mapRefToUserSpace(refFrame, userFrame);
        drawSkeleton(ctx, mappedRef, w, h, '#00ff88', 3, 0.55);

        // Draw target circles at ref joint positions (where to aim)
        if (highlightLandmarks && highlightLandmarks.length > 0) {
          for (const lIdx of highlightLandmarks) {
            const lm = userFrame[lIdx];
            const refLm = mappedRef[lIdx];
            if (!lm || !refLm || lm.visibility < 0.3) continue;

            const ux = lm.x * w, uy = lm.y * h;
            const rx = refLm.x * w, ry = refLm.y * h;
            const dist = Math.sqrt((rx - ux) ** 2 + (ry - uy) ** 2);
            if (dist < 3) continue; // too close, no need

            // Glow circle at target (ref) position — "move here"
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#00ff88';
            ctx.beginPath();
            ctx.arc(rx, ry, 16, 0, 2 * Math.PI);
            ctx.fill();
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(rx, ry, 16, 0, 2 * Math.PI);
            ctx.stroke();

            // Arrow line from current position → target position
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#ff2d78';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 5]);
            ctx.beginPath();
            ctx.moveTo(ux, uy);
            ctx.lineTo(rx, ry);
            ctx.stroke();
            ctx.setLineDash([]);

            // Filled arrow head at target
            const angle = Math.atan2(ry - uy, rx - ux);
            const headLen = 14;
            ctx.fillStyle = '#ff2d78';
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(
              rx - headLen * Math.cos(angle - Math.PI / 7),
              ry - headLen * Math.sin(angle - Math.PI / 7)
            );
            ctx.lineTo(
              rx - headLen * Math.cos(angle + Math.PI / 7),
              ry - headLen * Math.sin(angle + Math.PI / 7)
            );
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 1;
          }
        }

        // Also draw arrows for ALL joints with significant deviation (not just highlight)
        // This gives a full picture of "where to move"
        for (let i = 11; i < Math.min(userFrame.length, mappedRef.length); i++) {
          if (highlightLandmarks?.includes(i)) continue; // already drawn above
          const lm = userFrame[i];
          const refLm = mappedRef[i];
          if (!lm || !refLm || lm.visibility < 0.3 || refLm.visibility < 0.3) continue;

          const ux = lm.x * w, uy = lm.y * h;
          const rx = refLm.x * w, ry = refLm.y * h;
          const dist = Math.sqrt((rx - ux) ** 2 + (ry - uy) ** 2);
          if (dist < 12) continue; // small enough, skip

          // Subtle small arrow for non-primary joints
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#ff2d78';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(ux, uy);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    },
    [userPose, refPose, getRefFrameIdx]
  );

  // Animation loop
  const animate = useCallback(() => {
    const video = videoRef.current;
    if (!video || phase !== 'playing') return;

    const relTime = video.currentTime - userStartTime;
    const fi = Math.max(0, Math.min(Math.floor(relTime * userPose.fps), userPose.frames.length - 1));
    setCurrentUserFrame(fi);

    // Check if we should pause at next stop
    if (currentStopIdx < stops.length) {
      const nextStop = stops[currentStopIdx];
      if (fi >= nextStop.userFrameIdx) {
        // Pause!
        video.pause();
        setPhase('paused');
        setShowAdvice(false);
        // Slight delay before showing advice (for dramatic effect)
        setTimeout(() => setShowAdvice(true), 300);
        drawFrame(fi, true, nextStop.highlightLandmarks);
        return;
      }
    }

    drawFrame(fi, false);
    animRef.current = requestAnimationFrame(animate);
  }, [phase, userStartTime, userPose.fps, currentStopIdx, stops, drawFrame]);

  useEffect(() => {
    if (phase === 'playing') {
      animRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, animate]);

  // Handle video end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      setPhase('complete');
    };
    video.addEventListener('ended', onEnded);
    return () => video.removeEventListener('ended', onEnded);
  }, []);

  // Start lesson — set phase first so video mounts, then play after mount
  const startLesson = useCallback(() => {
    setCurrentStopIdx(0);
    setStopsCompleted(0);
    setPhase('playing');
  }, []);

  // When phase changes to 'playing' and video is freshly mounted, start playback
  useEffect(() => {
    if (phase !== 'playing') return;
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.currentTime = userStartTime;
      video.playbackRate = 0.1;
      video.play().catch((err) => console.warn('Lesson play failed:', err));
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      const onReady = () => {
        tryPlay();
        video.removeEventListener('canplay', onReady);
      };
      video.addEventListener('canplay', onReady);
      video.load();
      return () => video.removeEventListener('canplay', onReady);
    }
  }, [phase, userStartTime]);

  // Continue after advice pause
  const continueLesson = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setShowAdvice(false);
    setStopsCompleted((prev) => prev + 1);
    setCurrentStopIdx((prev) => prev + 1);

    // Small delay then resume
    setTimeout(() => {
      video.playbackRate = 0.1;
      video.play();
      setPhase('playing');
    }, 200);
  }, []);

  // Restart lesson
  const restartLesson = useCallback(() => {
    setPhase('select');
    setCurrentStopIdx(0);
    setStopsCompleted(0);
    setShowAdvice(false);
  }, []);

  const currentStop = phase === 'paused' && currentStopIdx < stops.length ? stops[currentStopIdx] : null;

  // Redraw when paused (for pulse animation)
  useEffect(() => {
    if (phase !== 'paused' || !currentStop) return;
    let frame = 0;
    const pulseAnim = () => {
      frame++;
      drawFrame(currentStop.userFrameIdx, true, currentStop.highlightLandmarks);
      if (phase === 'paused') {
        animRef.current = requestAnimationFrame(pulseAnim);
      }
    };
    animRef.current = requestAnimationFrame(pulseAnim);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, currentStop, drawFrame]);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs font-bold tracking-[0.15em] text-neon-pink mb-1">
        LESSON MODE
      </div>

      {/* ── Level Selection ── */}
      {phase === 'select' && (
        <div className="flex flex-col gap-4">
          <div className="text-center mb-2">
            <h3 className="text-lg font-bold bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent">
              レベルを選んでレッスン開始
            </h3>
            <p className="text-xs text-dark-500 mt-1">
              レベルが高いほど、大きなズレだけ指摘します
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {LEVELS.map((lv, i) => {
              const isSelected = levelIdx === i;
              const colorStyles: Record<string, { border: string; bg: string; text: string }> = {
                'neon-green': {
                  border: 'border-neon-green/60',
                  bg: 'bg-neon-green/10',
                  text: 'text-neon-green',
                },
                'neon-blue': {
                  border: 'border-neon-blue/60',
                  bg: 'bg-neon-blue/10',
                  text: 'text-neon-blue',
                },
                'neon-purple': {
                  border: 'border-neon-purple/60',
                  bg: 'bg-neon-purple/10',
                  text: 'text-neon-purple',
                },
                'neon-pink': {
                  border: 'border-neon-pink/60',
                  bg: 'bg-neon-pink/10',
                  text: 'text-neon-pink',
                },
              };
              const cs = colorStyles[lv.color];
              return (
                <button
                  key={lv.id}
                  onClick={() => setLevelIdx(i)}
                  className={`p-2.5 sm:p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? `${cs.border} ${cs.bg}`
                      : 'border-dark-600 bg-dark-800 hover:border-dark-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl sm:text-2xl">{lv.icon}</span>
                    <div>
                      <div className={`text-xs font-bold tracking-wider ${
                        isSelected ? cs.text : 'text-gray-400'
                      }`}>
                        {lv.name}
                      </div>
                      <div className="text-[10px] text-dark-500">{lv.nameJa}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500">{lv.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="text-center text-xs text-dark-500">
            {stops.length > 0
              ? `このレベルで ${stops.length} 箇所のチェックポイント`
              : 'このレベルではチェックポイントなし — Perfect!'}
          </div>

          <button
            onClick={startLesson}
            className="mx-auto px-8 sm:px-10 py-3 sm:py-4 rounded-2xl text-base sm:text-lg font-bold tracking-wide bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue text-white glow-pink hover:scale-105 active:scale-95 transition-all"
          >
            START LESSON
          </button>
        </div>
      )}

      {/* ── Video + Canvas + Advice Overlay ── */}
      <div className={`flex flex-col gap-3 ${phase === 'select' ? 'hidden' : ''}`}>
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dark-500 tracking-wider">
              {level.icon} {level.name}
            </span>
            <div className="flex-1 bg-dark-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-pink to-neon-purple transition-all duration-500"
                style={{
                  width: stops.length > 0
                    ? `${(stopsCompleted / stops.length) * 100}%`
                    : '100%',
                }}
              />
            </div>
            <span className="text-[10px] text-dark-500 font-mono">
              {stopsCompleted}/{stops.length}
            </span>
          </div>

          {/* Video container */}
          <div
            ref={containerRef}
            className="relative rounded-xl overflow-hidden bg-black border border-dark-600"
            style={{ aspectRatio: '16 / 9' }}
          >
            <video
              ref={videoRef}
              src={userVideoUrl || undefined}
              className="w-full h-full object-contain"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Small overlay badges when paused — minimal so video stays visible */}
            {phase === 'paused' && currentStop && showAdvice && (
              <>
                {/* Score badge — top right */}
                <div className="absolute top-3 right-3 animate-fade-in pointer-events-none">
                  <div className="bg-dark-900/70 backdrop-blur-sm rounded-lg px-3 py-1 border border-neon-pink/30">
                    <span className="text-lg font-black text-neon-pink text-glow-pink">
                      {Math.round(currentStop.score)}
                    </span>
                  </div>
                </div>

                {/* Compact legend — top left */}
                <div className="absolute top-3 left-3 animate-fade-in pointer-events-none">
                  <div className="bg-dark-900/70 backdrop-blur-sm rounded-lg px-2 py-1 border border-dark-600 flex items-center gap-2 text-[9px]">
                    <span className="text-neon-green/70">● お手本</span>
                    <span className="text-neon-blue">● あなた</span>
                    <span className="text-neon-pink">→ 修正</span>
                  </div>
                </div>

                {/* Advice ribbon at bottom of video */}
                <div className="absolute bottom-0 left-0 right-0 animate-slide-in pointer-events-none">
                  <div className="bg-gradient-to-t from-dark-900/95 via-dark-900/80 to-transparent px-3 sm:px-5 pt-6 sm:pt-8 pb-3 sm:pb-4">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1">
                      {currentStop.worstParts.length > 0 && (
                        <span className="text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 rounded-full bg-neon-pink/20 text-neon-pink border border-neon-pink/30 flex-shrink-0">
                          {currentStop.worstParts[0]}
                        </span>
                      )}
                      <span className="text-base sm:text-xl md:text-2xl font-black text-white text-glow-pink tracking-wide">
                        {currentStop.advice.main}
                      </span>
                    </div>
                    <div className="text-sm sm:text-base text-gray-300 font-medium">
                      {currentStop.advice.sub}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Playing indicator */}
            {phase === 'playing' && (
              <div className="absolute top-4 left-4">
                <div className="bg-dark-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-neon-green animate-neon-pulse" />
                  <span className="text-[10px] text-gray-400 font-mono tracking-wider">
                    0.1x LESSON
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3">
            <button
              onClick={restartLesson}
              className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-pink/50 hover:text-neon-pink transition-all"
            >
              RESTART
            </button>
            {phase === 'paused' && currentStop && showAdvice && (
              <button
                onClick={continueLesson}
                className="px-8 py-2.5 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <span>NEXT</span>
                <span className="animate-arrow-bounce inline-block">→</span>
              </button>
            )}
            {phase === 'playing' && (
              <button
                onClick={() => {
                  videoRef.current?.pause();
                  setPhase('select');
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider bg-dark-700 text-gray-400 border border-dark-600 hover:border-dark-500 transition-all"
              >
                STOP
              </button>
            )}
          </div>
      </div>

      {/* ── Completion Screen ── */}
      {phase === 'complete' && (
        <div className="flex flex-col items-center gap-4 sm:gap-6 py-6 sm:py-8">
          <div className="text-5xl sm:text-6xl">
            {stopsCompleted === 0 ? '👑' : stopsCompleted <= 2 ? '⭐' : '🔥'}
          </div>
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue bg-clip-text text-transparent mb-2">
              LESSON COMPLETE!
            </h3>
            <p className="text-sm text-gray-400">
              {stopsCompleted === 0 && stops.length === 0
                ? 'パーフェクト！修正ポイントなし！'
                : `${stops.length} 箇所のポイントをチェックしました`}
            </p>
          </div>

          {/* Stats */}
          <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-dark-500 tracking-wider">LEVEL</span>
              <span className="text-sm font-bold">
                {level.icon} {level.name}
              </span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-dark-500 tracking-wider">CHECK POINTS</span>
              <span className="text-sm font-bold text-neon-purple">{stops.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-dark-500 tracking-wider">OVERALL SCORE</span>
              <span className="text-sm font-bold bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent">
                {result.overallScore}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={restartLesson}
              className="px-6 py-3 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all"
            >
              RETRY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
