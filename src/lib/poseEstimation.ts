import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import type { PoseFrame, PoseData } from '../types/pose';

let cachedVision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;

async function getVision() {
  if (cachedVision) return cachedVision;
  cachedVision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
  );
  return cachedVision;
}

async function createLandmarker(): Promise<PoseLandmarker> {
  const vision = await getVision();

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  } catch {
    console.warn('GPU delegate failed, falling back to CPU');
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }
}

const TARGET_FPS = 10;

export async function extractPoseFromVideo(
  videoElement: HTMLVideoElement,
  onProgress?: (progress: number) => void,
  startTime: number = 0
): Promise<PoseData> {
  // Create a fresh landmarker for each video to avoid timestamp conflicts
  const landmarker = await createLandmarker();
  const frames: PoseFrame[] = [];

  const duration = videoElement.duration;
  if (!duration || !isFinite(duration)) {
    throw new Error('動画の長さを取得できません');
  }

  const effectiveDuration = duration - startTime;
  if (effectiveDuration <= 0) {
    throw new Error('開始地点が動画の長さを超えています');
  }

  const frameInterval = 1 / TARGET_FPS;
  const totalFrames = Math.floor(effectiveDuration * TARGET_FPS);

  videoElement.pause();

  let lastTimestampMs = -1;

  for (let i = 0; i < totalFrames; i++) {
    const time = startTime + i * frameInterval;
    videoElement.currentTime = time;
    await waitForSeek(videoElement);

    // Timestamps must be strictly increasing (start from 1)
    const timestampMs = Math.max(Math.round(time * 1000), lastTimestampMs + 1);
    lastTimestampMs = timestampMs;

    try {
      const result = landmarker.detectForVideo(videoElement, timestampMs);

      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks: PoseFrame = result.landmarks[0].map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility ?? 0,
        }));
        frames.push(landmarks);
      } else {
        frames.push([]);
      }
    } catch (err) {
      console.warn(`Frame ${i} detection failed:`, err);
      frames.push([]);
    }

    onProgress?.(((i + 1) / totalFrames) * 100);
  }

  // Close the landmarker to free resources
  landmarker.close();

  return { frames, fps: TARGET_FPS, duration: effectiveDuration };
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (!video.seeking) {
      resolve();
      return;
    }
    const onSeeked = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 3000);
    video.addEventListener('seeked', onSeeked, { once: true });
  });
}

export function getDrawingUtils(ctx: CanvasRenderingContext2D): DrawingUtils {
  return new DrawingUtils(ctx);
}
