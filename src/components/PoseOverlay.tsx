import { useEffect, useRef } from 'react';
import type { PoseFrame } from '../types/pose';
import { POSE_CONNECTIONS } from '../types/pose';

interface PoseOverlayProps {
  /** The pose to draw on this video */
  poseFrame?: PoseFrame;
  /** Optional: the other video's pose for diff highlighting (coordinates compared in normalized space) */
  diffFrame?: PoseFrame;
  /** Color of the skeleton lines */
  color: string;
  /** Native video width */
  width: number;
  /** Native video height */
  height: number;
  /** Optional zoom factor to match video scale */
  zoom?: number;
}

function drawPose(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  color: string,
  width: number,
  height: number,
  diffFrame?: PoseFrame
) {
  if (frame.length === 0) return;

  // Draw connections
  for (const [i, j] of POSE_CONNECTIONS) {
    if (!frame[i] || !frame[j]) continue;
    if (frame[i].visibility < 0.3 || frame[j].visibility < 0.3) continue;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    // Highlight diff: compare normalized positions (x,y are 0-1 range from MediaPipe)
    if (diffFrame && diffFrame.length > 0 && diffFrame[i] && diffFrame[j]) {
      const di = Math.sqrt(
        (frame[i].x - diffFrame[i].x) ** 2 + (frame[i].y - diffFrame[i].y) ** 2
      );
      const dj = Math.sqrt(
        (frame[j].x - diffFrame[j].x) ** 2 + (frame[j].y - diffFrame[j].y) ** 2
      );
      if ((di + dj) / 2 > 0.06) {
        ctx.strokeStyle = '#ff2d78';
        ctx.lineWidth = 4;
      }
    }

    ctx.beginPath();
    ctx.moveTo(frame[i].x * width, frame[i].y * height);
    ctx.lineTo(frame[j].x * width, frame[j].y * height);
    ctx.stroke();
  }

  // Draw landmarks (body only, skip face landmarks 0-10)
  for (let i = 11; i < frame.length; i++) {
    const lm = frame[i];
    if (!lm || lm.visibility < 0.3) continue;

    ctx.fillStyle = color;

    if (diffFrame && diffFrame.length > 0 && diffFrame[i]) {
      const d = Math.sqrt((lm.x - diffFrame[i].x) ** 2 + (lm.y - diffFrame[i].y) ** 2);
      if (d > 0.06) ctx.fillStyle = '#ff2d78';
    }

    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export default function PoseOverlay({
  poseFrame,
  diffFrame,
  color,
  width,
  height,
  zoom = 1,
}: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (poseFrame && poseFrame.length > 0) {
      drawPose(ctx, poseFrame, color, width, height, diffFrame);
    }
  }, [poseFrame, diffFrame, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: 'center center' } : undefined}
    />
  );
}
