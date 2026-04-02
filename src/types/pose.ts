export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type PoseFrame = Landmark[];

export interface PoseData {
  frames: PoseFrame[];
  fps: number;
  duration: number;
}

export interface BodyPartScore {
  name: string;
  nameJa: string;
  score: number;
  landmarks: number[];
}

export interface FrameDiff {
  frameIndex: number;
  time: number;
  score: number;
  worstParts: string[];
}

export interface DanceAdvice {
  icon: string;          // emoji icon
  bodyPart: string;      // e.g. "左腕"
  severity: 'high' | 'medium' | 'low';
  message: string;       // e.g. "肘をもっと伸ばしましょう"
  detail: string;        // e.g. "お手本より約20°曲がっています"
  timeHint: string;      // e.g. "特に 0:05〜0:10 あたり"
}

export interface ComparisonResult {
  overallScore: number;
  bodyPartScores: BodyPartScore[];
  frameDiffs: FrameDiff[];
  alignedRefFrames: number[];
  alignedUserFrames: number[];
  advices: DanceAdvice[];
}

// MediaPipe Pose landmark indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

// Skeleton connections for drawing
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [15, 17], [15, 19], [15, 21],
  [16, 18], [16, 20], [16, 22], [27, 29], [29, 31],
  [28, 30], [30, 32],
];

// Body part groupings for scoring
export const BODY_PARTS: { name: string; nameJa: string; landmarks: number[] }[] = [
  { name: 'leftArm', nameJa: '左腕', landmarks: [11, 13, 15, 17, 19, 21] },
  { name: 'rightArm', nameJa: '右腕', landmarks: [12, 14, 16, 18, 20, 22] },
  { name: 'torso', nameJa: '体幹', landmarks: [11, 12, 23, 24] },
  { name: 'leftLeg', nameJa: '左脚', landmarks: [23, 25, 27, 29, 31] },
  { name: 'rightLeg', nameJa: '右脚', landmarks: [24, 26, 28, 30, 32] },
];

// Joint angles to compute (triplets: [a, b, c] = angle at b)
export const JOINT_ANGLES: { name: string; joints: [number, number, number] }[] = [
  { name: 'leftElbow', joints: [11, 13, 15] },
  { name: 'rightElbow', joints: [12, 14, 16] },
  { name: 'leftShoulder', joints: [13, 11, 23] },
  { name: 'rightShoulder', joints: [14, 12, 24] },
  { name: 'leftHip', joints: [11, 23, 25] },
  { name: 'rightHip', joints: [12, 24, 26] },
  { name: 'leftKnee', joints: [23, 25, 27] },
  { name: 'rightKnee', joints: [24, 26, 28] },
];
