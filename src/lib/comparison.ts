import type {
  PoseData,
  PoseFrame,
  Landmark,
  ComparisonResult,
  BodyPartScore,
  FrameDiff,
  DanceAdvice,
} from '../types/pose';
import { JOINT_ANGLES, BODY_PARTS } from '../types/pose';
import { dtw } from './dtw';
import {
  computeAverageBoneLengths,
  computeStandardBoneLengths,
  retargetFrame,
  type BoneLengthMap,
} from './skeletonNormalize';

// Calculate angle at point B given points A, B, C
function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);

  if (magAB === 0 || magCB === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// Extract joint angles from a pose frame
function extractAngles(frame: PoseFrame): number[] {
  if (frame.length === 0) return new Array(JOINT_ANGLES.length).fill(0);

  return JOINT_ANGLES.map(({ joints: [a, b, c] }) => {
    if (!frame[a] || !frame[b] || !frame[c]) return 0;
    return angleBetween(frame[a], frame[b], frame[c]);
  });
}

// Compute average body scale across all valid frames
function computeAverageScale(frames: PoseFrame[]): number {
  let totalScale = 0;
  let count = 0;
  for (const frame of frames) {
    if (frame.length === 0) continue;
    const lh = frame[23], rh = frame[24], ls = frame[11], rs = frame[12];
    if (!lh || !rh || !ls || !rs) continue;
    const cx = (lh.x + rh.x) / 2;
    const cy = (lh.y + rh.y) / 2;
    const sx = (ls.x + rs.x) / 2 - cx;
    const sy = (ls.y + rs.y) / 2 - cy;
    const s = Math.sqrt(sx ** 2 + sy ** 2);
    if (s > 0) { totalScale += s; count++; }
  }
  return count > 0 ? totalScale / count : 1;
}

// Normalize landmarks: center on hip midpoint, scale by provided body scale
function normalizeLandmarks(frame: PoseFrame, avgScale?: number): PoseFrame {
  if (frame.length === 0) return frame;

  const leftHip = frame[23];
  const rightHip = frame[24];

  if (!leftHip || !rightHip) return frame;

  const cx = (leftHip.x + rightHip.x) / 2;
  const cy = (leftHip.y + rightHip.y) / 2;
  const cz = (leftHip.z + rightHip.z) / 2;

  // Use provided average scale, or compute per-frame fallback
  let scale = avgScale;
  if (!scale || scale <= 0) {
    const ls = frame[11], rs = frame[12];
    if (ls && rs) {
      const sx = (ls.x + rs.x) / 2 - cx;
      const sy = (ls.y + rs.y) / 2 - cy;
      const sz = (ls.z + rs.z) / 2 - cz;
      scale = Math.sqrt(sx ** 2 + sy ** 2 + sz ** 2) || 1;
    } else {
      scale = 1;
    }
  }

  return frame.map((lm) => ({
    x: (lm.x - cx) / scale,
    y: (lm.y - cy) / scale,
    z: (lm.z - cz) / scale,
    visibility: lm.visibility,
  }));
}

// Euclidean distance between two angle vectors
function angleDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// Score based on angle differences (more lenient)
function angleScore(refAngles: number[], userAngles: number[]): number {
  if (refAngles.length === 0) return 50;

  let totalDiff = 0;
  let count = 0;
  for (let i = 0; i < refAngles.length; i++) {
    // Skip if both are 0 (no data)
    if (refAngles[i] === 0 && userAngles[i] === 0) continue;
    const diff = Math.abs(refAngles[i] - userAngles[i]);
    // Max expected diff is ~180 degrees; map to 0-1
    totalDiff += Math.min(diff / 180, 1);
    count++;
  }

  if (count === 0) return 70; // default when no valid angles

  const avgDiff = totalDiff / count;
  // Convert to score: 0 diff = 100, 0.5 diff (90 degrees) = 30
  // Using a curve that's lenient for small differences
  const score = Math.max(0, 100 * (1 - avgDiff * 1.5));
  return score;
}

// Score a single frame pair (0-100)
function scoreFrame(
  refFrame: PoseFrame,
  userFrame: PoseFrame,
  refScale: number,
  userScale: number,
  standardBones?: BoneLengthMap
): number {
  if (refFrame.length === 0 || userFrame.length === 0) return -1;

  const refAngles = extractAngles(refFrame);
  const userAngles = extractAngles(userFrame);

  const aScore = angleScore(refAngles, userAngles);

  // Retarget bone lengths to standard proportions before position comparison
  const retargetedRef = standardBones ? retargetFrame(refFrame, standardBones) : refFrame;
  const retargetedUser = standardBones ? retargetFrame(userFrame, standardBones) : userFrame;

  // Normalize using consistent average body scale
  const normRef = normalizeLandmarks(retargetedRef, refScale);
  const normUser = normalizeLandmarks(retargetedUser, userScale);

  let positionSim = 0;
  let count = 0;
  for (let i = 11; i < 33; i++) {
    if (normRef[i] && normUser[i] && normRef[i].visibility > 0.3 && normUser[i].visibility > 0.3) {
      const dx = normRef[i].x - normUser[i].x;
      const dy = normRef[i].y - normUser[i].y;
      const dist = Math.sqrt(dx ** 2 + dy ** 2);
      positionSim += Math.max(0, 1 - dist * 1.5);
      count++;
    }
  }
  const pScore = count > 0 ? (positionSim / count) * 100 : 50;

  const score = aScore * 0.6 + pScore * 0.4;
  const curved = 30 + (score / 100) * 70;

  return Math.max(0, Math.min(100, curved));
}

// Score specific body part for a frame pair
function scoreBodyPart(
  refFrame: PoseFrame,
  userFrame: PoseFrame,
  landmarkIndices: number[],
  refScale: number,
  userScale: number,
  standardBones?: BoneLengthMap
): number {
  if (refFrame.length === 0 || userFrame.length === 0) return -1;

  // Retarget bone lengths to standard proportions before comparison
  const retargetedRef = standardBones ? retargetFrame(refFrame, standardBones) : refFrame;
  const retargetedUser = standardBones ? retargetFrame(userFrame, standardBones) : userFrame;

  const normRef = normalizeLandmarks(retargetedRef, refScale);
  const normUser = normalizeLandmarks(retargetedUser, userScale);

  let sim = 0;
  let count = 0;
  for (const i of landmarkIndices) {
    if (normRef[i] && normUser[i] && normRef[i].visibility > 0.3 && normUser[i].visibility > 0.3) {
      const dx = normRef[i].x - normUser[i].x;
      const dy = normRef[i].y - normUser[i].y;
      const dist = Math.sqrt(dx ** 2 + dy ** 2);
      sim += Math.max(0, 1 - dist * 1.5);
      count++;
    }
  }

  if (count === 0) return -1;
  const raw = (sim / count) * 100;
  return 30 + (raw / 100) * 70;
}

// ──── Advice generation ────

// Joint angle analysis info
const ANGLE_ADVICE_MAP: {
  index: number;
  nameJa: string;
  icon: string;
  bodyPart: string;
  bendMsg: string;   // when user angle is smaller (more bent)
  extendMsg: string; // when user angle is larger (more extended)
  bendDetail: string;
  extendDetail: string;
}[] = [
  {
    index: 0, nameJa: '左肘', icon: '💪', bodyPart: '左腕',
    bendMsg: '左肘をもっと伸ばしましょう',
    extendMsg: '左肘をもっと曲げましょう',
    bendDetail: 'お手本より肘が約{deg}°曲がっています',
    extendDetail: 'お手本より肘が約{deg}°伸びすぎています',
  },
  {
    index: 1, nameJa: '右肘', icon: '💪', bodyPart: '右腕',
    bendMsg: '右肘をもっと伸ばしましょう',
    extendMsg: '右肘をもっと曲げましょう',
    bendDetail: 'お手本より肘が約{deg}°曲がっています',
    extendDetail: 'お手本より肘が約{deg}°伸びすぎています',
  },
  {
    index: 2, nameJa: '左肩', icon: '🙆', bodyPart: '左腕',
    bendMsg: '左腕をもっと上げましょう',
    extendMsg: '左腕を少し下げましょう',
    bendDetail: 'お手本より腕の開きが約{deg}°小さいです',
    extendDetail: 'お手本より腕の開きが約{deg}°大きいです',
  },
  {
    index: 3, nameJa: '右肩', icon: '🙆', bodyPart: '右腕',
    bendMsg: '右腕をもっと上げましょう',
    extendMsg: '右腕を少し下げましょう',
    bendDetail: 'お手本より腕の開きが約{deg}°小さいです',
    extendDetail: 'お手本より腕の開きが約{deg}°大きいです',
  },
  {
    index: 4, nameJa: '左股関節', icon: '🦵', bodyPart: '左脚',
    bendMsg: '左脚をもっと大きく動かしましょう',
    extendMsg: '左脚の動きを少しコンパクトに',
    bendDetail: 'お手本より股関節の動きが約{deg}°小さいです',
    extendDetail: 'お手本より股関節の動きが約{deg}°大きいです',
  },
  {
    index: 5, nameJa: '右股関節', icon: '🦵', bodyPart: '右脚',
    bendMsg: '右脚をもっと大きく動かしましょう',
    extendMsg: '右脚の動きを少しコンパクトに',
    bendDetail: 'お手本より股関節の動きが約{deg}°小さいです',
    extendDetail: 'お手本より股関節の動きが約{deg}°大きいです',
  },
  {
    index: 6, nameJa: '左膝', icon: '🦿', bodyPart: '左脚',
    bendMsg: '左膝をもっと伸ばしましょう',
    extendMsg: '左膝をもっと曲げましょう',
    bendDetail: 'お手本より膝が約{deg}°曲がっています',
    extendDetail: 'お手本より膝が約{deg}°伸びすぎています',
  },
  {
    index: 7, nameJa: '右膝', icon: '🦿', bodyPart: '右脚',
    bendMsg: '右膝をもっと伸ばしましょう',
    extendMsg: '右膝をもっと曲げましょう',
    bendDetail: 'お手本より膝が約{deg}°曲がっています',
    extendDetail: 'お手本より膝が約{deg}°伸びすぎています',
  },
];

// Position-based landmark analysis
const POSITION_LANDMARKS: {
  index: number;
  nameJa: string;
  icon: string;
  bodyPart: string;
}[] = [
  { index: 15, nameJa: '左手', icon: '✋', bodyPart: '左腕' },
  { index: 16, nameJa: '右手', icon: '✋', bodyPart: '右腕' },
  { index: 27, nameJa: '左足', icon: '👟', bodyPart: '左脚' },
  { index: 28, nameJa: '右足', icon: '👟', bodyPart: '右脚' },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Generate specific, actionable dance advice by analyzing joint angle
 * and position differences between ref and user across aligned frames.
 */
function generateAdvice(
  ref: PoseData,
  user: PoseData,
  alignedPairs: Map<number, number>,
  refScale: number,
  userScale: number,
  standardBones: BoneLengthMap,
  fps: number
): DanceAdvice[] {
  const advices: DanceAdvice[] = [];

  // ── 1. Joint angle analysis ──
  // For each joint angle, collect (userAngle - refAngle) across all aligned frames
  const angleDiffs: { diffs: number[]; times: number[] }[] = ANGLE_ADVICE_MAP.map(() => ({
    diffs: [],
    times: [],
  }));

  for (const [ri, ui] of alignedPairs) {
    const refFrame = ref.frames[ri];
    const userFrame = user.frames[ui];
    if (refFrame.length === 0 || userFrame.length === 0) continue;

    const refAngles = extractAngles(refFrame);
    const userAngles = extractAngles(userFrame);

    for (let j = 0; j < ANGLE_ADVICE_MAP.length; j++) {
      const rA = refAngles[ANGLE_ADVICE_MAP[j].index];
      const uA = userAngles[ANGLE_ADVICE_MAP[j].index];
      if (rA === 0 && uA === 0) continue; // no data
      const diff = uA - rA; // positive = user more extended
      angleDiffs[j].diffs.push(diff);
      angleDiffs[j].times.push(ri / fps);
    }
  }

  for (let j = 0; j < ANGLE_ADVICE_MAP.length; j++) {
    const { diffs, times } = angleDiffs[j];
    if (diffs.length < 5) continue;

    // Average difference
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const absDiff = Math.abs(avgDiff);

    // Only generate advice for significant differences (> 12 degrees average)
    if (absDiff < 12) continue;

    const info = ANGLE_ADVICE_MAP[j];
    const severity: DanceAdvice['severity'] = absDiff > 30 ? 'high' : absDiff > 20 ? 'medium' : 'low';
    const isBent = avgDiff < 0; // user angle is smaller = more bent/closed

    // Find the worst time range
    const worstTimes = diffs
      .map((d, i) => ({ d: Math.abs(d), t: times[i] }))
      .sort((a, b) => b.d - a.d)
      .slice(0, Math.ceil(diffs.length * 0.3));

    const minTime = Math.min(...worstTimes.map((w) => w.t));
    const maxTime = Math.max(...worstTimes.map((w) => w.t));
    const timeHint = `特に ${formatTime(minTime)}〜${formatTime(maxTime)} あたり`;

    const degStr = String(Math.round(absDiff));
    advices.push({
      icon: info.icon,
      bodyPart: info.bodyPart,
      severity,
      message: isBent ? info.bendMsg : info.extendMsg,
      detail: (isBent ? info.bendDetail : info.extendDetail).replace('{deg}', degStr),
      timeHint,
    });
  }

  // ── 2. Position analysis (hands/feet too high/low/left/right) ──
  const posDiffs: { dx: number[]; dy: number[]; times: number[] }[] = POSITION_LANDMARKS.map(() => ({
    dx: [], dy: [], times: [],
  }));

  for (const [ri, ui] of alignedPairs) {
    const refFrame = ref.frames[ri];
    const userFrame = user.frames[ui];
    if (refFrame.length === 0 || userFrame.length === 0) continue;

    const retRef = retargetFrame(refFrame, standardBones);
    const retUser = retargetFrame(userFrame, standardBones);
    const normRef = normalizeLandmarks(retRef, refScale);
    const normUser = normalizeLandmarks(retUser, userScale);

    for (let j = 0; j < POSITION_LANDMARKS.length; j++) {
      const idx = POSITION_LANDMARKS[j].index;
      const r = normRef[idx];
      const u = normUser[idx];
      if (!r || !u || r.visibility < 0.3 || u.visibility < 0.3) continue;

      // user - ref: positive dx = user is more to the right, positive dy = user is lower
      posDiffs[j].dx.push(u.x - r.x);
      posDiffs[j].dy.push(u.y - r.y);
      posDiffs[j].times.push(ri / fps);
    }
  }

  for (let j = 0; j < POSITION_LANDMARKS.length; j++) {
    const { dx, dy, times } = posDiffs[j];
    if (dx.length < 5) continue;

    const avgDx = dx.reduce((a, b) => a + b, 0) / dx.length;
    const avgDy = dy.reduce((a, b) => a + b, 0) / dy.length;
    const absDx = Math.abs(avgDx);
    const absDy = Math.abs(avgDy);

    const info = POSITION_LANDMARKS[j];
    const threshold = 0.08; // normalized coordinate threshold

    // Vertical advice (Y axis)
    if (absDy > threshold) {
      const severity: DanceAdvice['severity'] = absDy > 0.2 ? 'high' : absDy > 0.12 ? 'medium' : 'low';
      const isLower = avgDy > 0; // positive Y = lower in screen

      // Find worst time range
      const worstTimes = dy
        .map((d, i) => ({ d: Math.abs(d), t: times[i] }))
        .sort((a, b) => b.d - a.d)
        .slice(0, Math.ceil(dy.length * 0.3));
      const minTime = Math.min(...worstTimes.map((w) => w.t));
      const maxTime = Math.max(...worstTimes.map((w) => w.t));

      advices.push({
        icon: info.icon,
        bodyPart: info.bodyPart,
        severity,
        message: isLower
          ? `${info.nameJa}をもっと上に上げましょう`
          : `${info.nameJa}を少し下げましょう`,
        detail: isLower
          ? `お手本より${info.nameJa}の位置が低くなっています`
          : `お手本より${info.nameJa}の位置が高くなっています`,
        timeHint: `特に ${formatTime(minTime)}〜${formatTime(maxTime)} あたり`,
      });
    }

    // Horizontal advice (X axis) - only for hands
    if (absDx > threshold && info.index <= 16) {
      const severity: DanceAdvice['severity'] = absDx > 0.2 ? 'high' : absDx > 0.12 ? 'medium' : 'low';
      const isLeftSide = info.index === 15; // left wrist
      const isMoreOutward = isLeftSide ? avgDx < 0 : avgDx > 0;

      const worstTimes = dx
        .map((d, i) => ({ d: Math.abs(d), t: times[i] }))
        .sort((a, b) => b.d - a.d)
        .slice(0, Math.ceil(dx.length * 0.3));
      const minTime = Math.min(...worstTimes.map((w) => w.t));
      const maxTime = Math.max(...worstTimes.map((w) => w.t));

      advices.push({
        icon: '↔️',
        bodyPart: info.bodyPart,
        severity,
        message: isMoreOutward
          ? `${info.nameJa}をもう少し体の近くに`
          : `${info.nameJa}をもっと外側に広げましょう`,
        detail: isMoreOutward
          ? `お手本より${info.nameJa}が外側に出すぎています`
          : `お手本より${info.nameJa}が体に近すぎます`,
        timeHint: `特に ${formatTime(minTime)}〜${formatTime(maxTime)} あたり`,
      });
    }
  }

  // ── 3. Overall rhythm/energy advice ──
  // Check if user's movements are generally smaller (less dynamic)
  {
    let totalRefEnergy = 0;
    let totalUserEnergy = 0;
    let count = 0;

    const pairs = Array.from(alignedPairs.entries());
    for (let k = 1; k < pairs.length; k++) {
      const [prevRi] = pairs[k - 1];
      const [ri] = pairs[k];
      const prevUi = alignedPairs.get(prevRi)!;
      const ui = alignedPairs.get(ri)!;

      const refPrev = extractAngles(ref.frames[prevRi]);
      const refCurr = extractAngles(ref.frames[ri]);
      const userPrev = extractAngles(user.frames[prevUi]);
      const userCurr = extractAngles(user.frames[ui]);

      let refE = 0, userE = 0;
      for (let j = 0; j < refPrev.length; j++) {
        refE += (refCurr[j] - refPrev[j]) ** 2;
        userE += (userCurr[j] - userPrev[j]) ** 2;
      }
      totalRefEnergy += Math.sqrt(refE);
      totalUserEnergy += Math.sqrt(userE);
      count++;
    }

    if (count > 0) {
      const ratio = totalUserEnergy / (totalRefEnergy || 1);
      if (ratio < 0.65) {
        advices.push({
          icon: '🔥',
          bodyPart: '全体',
          severity: ratio < 0.45 ? 'high' : 'medium',
          message: '動きをもっと大きくダイナミックに！',
          detail: `お手本と比べて動きの大きさが${Math.round(ratio * 100)}%程度です`,
          timeHint: '全体を通して意識しましょう',
        });
      } else if (ratio > 1.5) {
        advices.push({
          icon: '🎯',
          bodyPart: '全体',
          severity: ratio > 2.0 ? 'high' : 'medium',
          message: '動きをもう少し丁寧にコントロールしましょう',
          detail: 'お手本よりも動きが大きすぎる傾向があります',
          timeHint: '全体を通して意識しましょう',
        });
      }
    }
  }

  // Sort by severity (high first), then deduplicate similar body parts
  const severityOrder = { high: 0, medium: 1, low: 2 };
  advices.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Keep at most 2 advices per body part, max 8 total
  const seen: Record<string, number> = {};
  const filtered: DanceAdvice[] = [];
  for (const adv of advices) {
    const cnt = seen[adv.bodyPart] || 0;
    if (cnt >= 2) continue;
    seen[adv.bodyPart] = cnt + 1;
    filtered.push(adv);
    if (filtered.length >= 8) break;
  }

  return filtered;
}

export function compareDances(ref: PoseData, user: PoseData): ComparisonResult {
  // Compute consistent body scale across all frames (handles different body sizes & camera distances)
  const refScale = computeAverageScale(ref.frames);
  const userScale = computeAverageScale(user.frames);

  // Compute standard bone lengths for proportion normalization
  const refBones = computeAverageBoneLengths(ref.frames);
  const userBones = computeAverageBoneLengths(user.frames);
  const standardBones = computeStandardBoneLengths(refBones, userBones);

  const refAngles = ref.frames.map(extractAngles);
  const userAngles = user.frames.map(extractAngles);

  // Filter out fully empty frames for DTW
  const validRefIdx = refAngles.map((_, i) => i).filter((i) => ref.frames[i].length > 0);
  const validUserIdx = userAngles.map((_, i) => i).filter((i) => user.frames[i].length > 0);

  const validRefAngles = validRefIdx.map((i) => refAngles[i]);
  const validUserAngles = validUserIdx.map((i) => userAngles[i]);

  if (validRefAngles.length === 0 || validUserAngles.length === 0) {
    return {
      overallScore: 0,
      bodyPartScores: BODY_PARTS.map((bp) => ({
        name: bp.name, nameJa: bp.nameJa, score: 0, landmarks: bp.landmarks,
      })),
      frameDiffs: [],
      alignedRefFrames: [],
      alignedUserFrames: [],
      advices: [],
    };
  }

  const dtwResult = dtw(validRefAngles, validUserAngles, angleDistance);

  const alignedPairs: Map<number, number> = new Map();
  for (const [ri, ui] of dtwResult.path) {
    const realRef = validRefIdx[ri];
    const realUser = validUserIdx[ui];
    if (!alignedPairs.has(realRef)) {
      alignedPairs.set(realRef, realUser);
    }
  }

  const alignedRefFrames: number[] = [];
  const alignedUserFrames: number[] = [];
  const frameScores: number[] = [];
  const frameDiffs: FrameDiff[] = [];

  for (const [ri, ui] of alignedPairs) {
    alignedRefFrames.push(ri);
    alignedUserFrames.push(ui);

    const score = scoreFrame(ref.frames[ri], user.frames[ui], refScale, userScale, standardBones);
    if (score < 0) continue;

    frameScores.push(score);

    const partScores = BODY_PARTS.map((bp) => ({
      name: bp.nameJa,
      score: scoreBodyPart(ref.frames[ri], user.frames[ui], bp.landmarks, refScale, userScale, standardBones),
    }));

    const worstParts = partScores
      .filter((p) => p.score >= 0 && p.score < 65)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((p) => p.name);

    frameDiffs.push({
      frameIndex: ri,
      time: ri / ref.fps,
      score,
      worstParts,
    });
  }

  const overallScore =
    frameScores.length > 0
      ? frameScores.reduce((sum, s) => sum + s, 0) / frameScores.length
      : 0;

  const bodyPartScores: BodyPartScore[] = BODY_PARTS.map((bp) => {
    const scores: number[] = [];
    for (const [ri, ui] of alignedPairs) {
      const s = scoreBodyPart(ref.frames[ri], user.frames[ui], bp.landmarks, refScale, userScale, standardBones);
      if (s >= 0) scores.push(s);
    }
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 50;
    return {
      name: bp.name,
      nameJa: bp.nameJa,
      score: Math.round(avg),
      landmarks: bp.landmarks,
    };
  });

  // Generate specific dance advice
  const advices = generateAdvice(ref, user, alignedPairs, refScale, userScale, standardBones, ref.fps);

  return {
    overallScore: Math.round(overallScore),
    bodyPartScores,
    frameDiffs,
    alignedRefFrames,
    alignedUserFrames,
    advices,
  };
}
