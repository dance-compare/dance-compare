import type { PoseData, PoseFrame } from '../types/pose';
import { JOINT_ANGLES } from '../types/pose';

// Calculate angle at point B given points A, B, C
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

// Compute per-frame "motion signature" — the change in angles between consecutive frames
// This captures the rhythm/timing of movement, not static poses
function computeMotionSignature(poses: PoseData): number[] {
  const sig: number[] = [];
  for (let i = 1; i < poses.frames.length; i++) {
    const prev = extractAngles(poses.frames[i - 1]);
    const curr = extractAngles(poses.frames[i]);
    let energy = 0;
    for (let j = 0; j < prev.length; j++) {
      energy += (curr[j] - prev[j]) ** 2;
    }
    sig.push(Math.sqrt(energy));
  }
  return sig;
}

// Normalize a signal to zero mean and unit variance
function normalize(signal: number[]): number[] {
  const n = signal.length;
  if (n === 0) return [];
  let mean = 0;
  for (const v of signal) mean += v;
  mean /= n;
  let variance = 0;
  for (const v of signal) variance += (v - mean) ** 2;
  variance /= n;
  const std = Math.sqrt(variance) || 1;
  return signal.map((v) => (v - mean) / std);
}

/**
 * Cross-correlation to find the best time offset.
 * Slides signal B over signal A and finds the lag with highest correlation.
 * Returns the lag in frames (positive = B starts later, negative = A starts later).
 */
function crossCorrelation(sigA: number[], sigB: number[]): { bestLag: number; bestScore: number } {
  const maxLag = Math.min(Math.max(sigA.length, sigB.length), 100); // limit search to ±100 frames (~10s)

  let bestLag = 0;
  let bestScore = -Infinity;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;

    for (let i = 0; i < sigA.length; i++) {
      const j = i + lag;
      if (j >= 0 && j < sigB.length) {
        sum += sigA[i] * sigB[j];
        count++;
      }
    }

    if (count > 0) {
      const score = sum / count;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
  }

  return { bestLag, bestScore };
}

/**
 * Also use multi-joint angle cross-correlation for more precision.
 * Instead of just motion energy, compare actual joint angle trajectories.
 */
function crossCorrelationMultiChannel(
  posesA: PoseData,
  posesB: PoseData
): { bestLag: number; bestScore: number } {
  const numJoints = JOINT_ANGLES.length;
  const maxLag = Math.min(Math.max(posesA.frames.length, posesB.frames.length), 100);

  // Extract angle time series for each joint
  const anglesA: number[][] = [];
  const anglesB: number[][] = [];
  for (let j = 0; j < numJoints; j++) {
    const chA: number[] = [];
    const chB: number[] = [];
    for (const frame of posesA.frames) {
      chA.push(extractAngles(frame)[j]);
    }
    for (const frame of posesB.frames) {
      chB.push(extractAngles(frame)[j]);
    }
    anglesA.push(normalize(chA));
    anglesB.push(normalize(chB));
  }

  let bestLag = 0;
  let bestScore = -Infinity;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let totalSum = 0;
    let totalCount = 0;

    for (let j = 0; j < numJoints; j++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < anglesA[j].length; i++) {
        const k = i + lag;
        if (k >= 0 && k < anglesB[j].length) {
          sum += anglesA[j][i] * anglesB[j][k];
          count++;
        }
      }
      if (count > 0) {
        totalSum += sum / count;
        totalCount++;
      }
    }

    if (totalCount > 0) {
      const score = totalSum / totalCount;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
  }

  return { bestLag, bestScore };
}

/**
 * Find the matching start points using cross-correlation.
 * Combines motion energy correlation and multi-joint angle correlation.
 */
export function findMatchingStart(
  refPose: PoseData,
  userPose: PoseData
): { refStartFrame: number; userStartFrame: number } {
  if (refPose.frames.length < 5 || userPose.frames.length < 5) {
    return { refStartFrame: 0, userStartFrame: 0 };
  }

  // Method 1: Motion energy cross-correlation
  const refMotion = normalize(computeMotionSignature(refPose));
  const userMotion = normalize(computeMotionSignature(userPose));
  const energyResult = crossCorrelation(refMotion, userMotion);

  // Method 2: Multi-joint angle cross-correlation
  const angleResult = crossCorrelationMultiChannel(refPose, userPose);

  // Use the method with higher confidence (higher score)
  const bestLag = angleResult.bestScore > energyResult.bestScore
    ? angleResult.bestLag
    : energyResult.bestLag;

  console.log(
    `Auto-sync: energy lag=${energyResult.bestLag} (score=${energyResult.bestScore.toFixed(3)}), ` +
    `angle lag=${angleResult.bestLag} (score=${angleResult.bestScore.toFixed(3)}), ` +
    `chosen lag=${bestLag}`
  );

  // Positive lag means user video needs to skip ahead (user starts later)
  // Negative lag means ref video needs to skip ahead (ref starts later)
  let refStartFrame = 0;
  let userStartFrame = 0;

  if (bestLag > 0) {
    // User video is behind — skip user forward
    userStartFrame = bestLag;
  } else if (bestLag < 0) {
    // Ref video is behind — skip ref forward
    refStartFrame = Math.abs(bestLag);
  }

  console.log(
    `Auto-sync result: ref starts at frame ${refStartFrame} (${(refStartFrame / refPose.fps).toFixed(1)}s), ` +
    `user starts at frame ${userStartFrame} (${(userStartFrame / userPose.fps).toFixed(1)}s)`
  );

  return { refStartFrame, userStartFrame };
}
