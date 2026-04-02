import type { PoseFrame, Landmark } from '../types/pose';

/**
 * Skeleton proportion normalization (retargeting).
 * Adjusts bone lengths so that two people with different body proportions
 * (shoulder width, arm length, leg length, etc.) appear the same size.
 */

// Key bone segments [parent, child] - processed in parent-first order
const RETARGET_ORDER: [number, number][] = [
  // Torso: hip → shoulder on each side
  [23, 11], [24, 12],
  // Upper arms
  [11, 13], [12, 14],
  // Forearms
  [13, 15], [14, 16],
  // Thighs
  [23, 25], [24, 26],
  // Shins
  [25, 27], [26, 28],
];

// Secondary joints that follow their parent with the same ratio
const SECONDARY_CHAINS: [number, number][] = [
  // Left hand
  [15, 17], [15, 19], [15, 21],
  // Right hand
  [16, 18], [16, 20], [16, 22],
  // Left foot
  [27, 29], [29, 31],
  // Right foot
  [28, 30], [30, 32],
];

function dist2d(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Average bone lengths for a set of bone segments across many frames */
export interface BoneLengthMap {
  [key: string]: number; // "parentIdx-childIdx" → average length
}

function boneKey(parent: number, child: number): string {
  return `${parent}-${child}`;
}

/** Compute the average bone lengths across all valid frames */
export function computeAverageBoneLengths(frames: PoseFrame[]): BoneLengthMap {
  const allSegments = [...RETARGET_ORDER, ...SECONDARY_CHAINS];
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const [p, c] of allSegments) {
    const key = boneKey(p, c);
    sums[key] = 0;
    counts[key] = 0;
  }

  for (const frame of frames) {
    if (frame.length === 0) continue;
    for (const [p, c] of allSegments) {
      const pLm = frame[p];
      const cLm = frame[c];
      if (!pLm || !cLm) continue;
      if (pLm.visibility < 0.3 || cLm.visibility < 0.3) continue;
      const d = dist2d(pLm, cLm);
      if (d > 0.001) {
        const key = boneKey(p, c);
        sums[key] += d;
        counts[key]++;
      }
    }
  }

  const result: BoneLengthMap = {};
  for (const [p, c] of allSegments) {
    const key = boneKey(p, c);
    result[key] = counts[key] > 0 ? sums[key] / counts[key] : 0;
  }
  return result;
}

/**
 * Retarget a single frame's bone lengths to match target proportions.
 * Centers on hip midpoint first, then adjusts each bone segment
 * to match the target length while preserving joint angles (directions).
 */
export function retargetFrame(
  frame: PoseFrame,
  targetBones: BoneLengthMap
): PoseFrame {
  if (frame.length === 0) return frame;

  const lh = frame[23];
  const rh = frame[24];
  if (!lh || !rh) return frame;

  // Deep copy the frame
  const out: PoseFrame = frame.map((lm) => ({ ...lm }));

  // Center on hip midpoint
  // For hips, we keep them as-is relative to center (hip width scales with overall body)

  // Process main bone segments in order
  for (const [pIdx, cIdx] of RETARGET_ORDER) {
    const parent = out[pIdx];
    const child = out[cIdx];
    if (!parent || !child) continue;

    const key = boneKey(pIdx, cIdx);
    const target = targetBones[key];
    if (!target || target <= 0) continue;

    const dx = child.x - parent.x;
    const dy = child.y - parent.y;
    const current = Math.sqrt(dx * dx + dy * dy);

    if (current < 0.001) continue;

    const scale = target / current;
    out[cIdx] = {
      ...child,
      x: parent.x + dx * scale,
      y: parent.y + dy * scale,
      z: child.z, // keep z as-is
    };
  }

  // Process secondary chains (hands, feet)
  for (const [pIdx, cIdx] of SECONDARY_CHAINS) {
    const parent = out[pIdx];
    const child = out[cIdx];
    if (!parent || !child) continue;

    const key = boneKey(pIdx, cIdx);
    const target = targetBones[key];
    if (!target || target <= 0) continue;

    const dx = child.x - parent.x;
    const dy = child.y - parent.y;
    const current = Math.sqrt(dx * dx + dy * dy);

    if (current < 0.001) continue;

    const scale = target / current;
    out[cIdx] = {
      ...child,
      x: parent.x + dx * scale,
      y: parent.y + dy * scale,
      z: child.z,
    };
  }

  return out;
}

/**
 * Compute "standard" bone lengths from a reference PoseData.
 * This is used as the target for retargeting both ref and user skeletons.
 */
export function computeStandardBoneLengths(
  refBones: BoneLengthMap,
  userBones: BoneLengthMap
): BoneLengthMap {
  // Use the average of both as the standard (so neither looks distorted)
  const standard: BoneLengthMap = {};
  const allKeys = new Set([...Object.keys(refBones), ...Object.keys(userBones)]);
  for (const key of allKeys) {
    const r = refBones[key] || 0;
    const u = userBones[key] || 0;
    if (r > 0 && u > 0) {
      standard[key] = (r + u) / 2;
    } else {
      standard[key] = r || u;
    }
  }
  return standard;
}
