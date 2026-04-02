import type { PoseFrame, PoseData } from '../types/pose';

// Detect when significant body movement starts in pose data
// by measuring frame-to-frame landmark displacement
export function detectMotionStart(poseData: PoseData): number {
  const { frames, fps } = poseData;
  if (frames.length < 3) return 0;

  const displacements: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    displacements.push(frameDisplacement(prev, curr));
  }

  if (displacements.length === 0) return 0;

  // Compute baseline: average of first 1 second (usually still/idle)
  const baselineFrames = Math.min(Math.floor(fps), displacements.length);
  let baselineMean = 0;
  for (let i = 0; i < baselineFrames; i++) {
    baselineMean += displacements[i];
  }
  baselineMean /= baselineFrames;

  let baselineStd = 0;
  for (let i = 0; i < baselineFrames; i++) {
    baselineStd += (displacements[i] - baselineMean) ** 2;
  }
  baselineStd = Math.sqrt(baselineStd / baselineFrames);

  // Threshold: baseline + 3 * std (or minimum threshold)
  const threshold = Math.max(baselineMean + baselineStd * 3, 0.01);

  // Find first frame where displacement exceeds threshold for 3+ consecutive frames
  for (let i = 0; i < displacements.length - 2; i++) {
    if (
      displacements[i] > threshold &&
      displacements[i + 1] > threshold &&
      displacements[i + 2] > threshold
    ) {
      // Return time slightly before the motion starts
      const startFrame = Math.max(0, i - 1);
      return startFrame / fps;
    }
  }

  return 0;
}

// Compute total displacement between two frames (body landmarks only)
function frameDisplacement(prev: PoseFrame, curr: PoseFrame): number {
  if (prev.length === 0 || curr.length === 0) return 0;

  let total = 0;
  let count = 0;

  // Only check major body landmarks (shoulders, elbows, wrists, hips, knees, ankles)
  const keyLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

  for (const i of keyLandmarks) {
    if (
      prev[i] && curr[i] &&
      prev[i].visibility > 0.3 && curr[i].visibility > 0.3
    ) {
      const dx = curr[i].x - prev[i].x;
      const dy = curr[i].y - prev[i].y;
      total += Math.sqrt(dx ** 2 + dy ** 2);
      count++;
    }
  }

  return count > 0 ? total / count : 0;
}
