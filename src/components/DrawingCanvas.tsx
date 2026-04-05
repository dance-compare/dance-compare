import { useRef, useState, useCallback, useEffect } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface DrawingCanvasProps {
  /** Native video width */
  videoWidth: number;
  /** Native video height */
  videoHeight: number;
  /** Whether drawing mode is active */
  isActive: boolean;
  /** Zoom factor to match video scale */
  zoom?: number;
}

const COLORS = [
  { value: '#ff2d78', label: 'Pink' },
  { value: '#00ff88', label: 'Green' },
  { value: '#00d4ff', label: 'Blue' },
  { value: '#ffff00', label: 'Yellow' },
  { value: '#ffffff', label: 'White' },
  { value: '#ff8800', label: 'Orange' },
];

const LINE_WIDTHS = [2, 4, 8];

export default function DrawingCanvas({
  videoWidth,
  videoHeight,
  isActive,
  zoom = 1,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [penColor, setPenColor] = useState('#ff2d78');
  const [penWidth, setPenWidth] = useState(4);
  const isDrawing = useRef(false);

  // Convert mouse/touch event to canvas coordinates
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      // Map CSS pixel position to canvas coordinate
      const x = ((clientX - rect.left) / rect.width) * videoWidth;
      const y = ((clientY - rect.top) / rect.height) * videoHeight;
      return { x, y };
    },
    [videoWidth, videoHeight]
  );

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isActive) return;
      e.preventDefault();
      isDrawing.current = true;
      const point = getCanvasPoint(e);
      setCurrentStroke({ points: [point], color: penColor, width: penWidth });
    },
    [isActive, getCanvasPoint, penColor, penWidth]
  );

  const moveDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing.current || !currentStroke) return;
      e.preventDefault();
      const point = getCanvasPoint(e);
      setCurrentStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, point] } : null
      );
    },
    [getCanvasPoint, currentStroke]
  );

  const endDraw = useCallback(() => {
    if (!isDrawing.current || !currentStroke) return;
    isDrawing.current = false;
    if (currentStroke.points.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  }, [currentStroke]);

  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const clearAll = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  // Redraw all strokes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx.clearRect(0, 0, videoWidth, videoHeight);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allStrokes = currentStroke
      ? [...strokes, currentStroke]
      : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, currentStroke, videoWidth, videoHeight]);

  return (
    <>
      {/* Drawing canvas layer */}
      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full ${
          isActive ? 'cursor-crosshair z-20' : 'pointer-events-none z-10'
        }`}
        style={zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: 'center center' } : undefined}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />

      {/* Toolbar - shown when drawing mode is active */}
      {isActive && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-dark-900/90 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-dark-600">
          {/* Colors */}
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setPenColor(c.value)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                penColor === c.value ? 'border-white scale-125' : 'border-dark-500'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}

          <div className="w-px h-5 bg-dark-500 mx-1" />

          {/* Line widths */}
          {LINE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setPenWidth(w)}
              className={`flex items-center justify-center w-6 h-6 rounded transition-all ${
                penWidth === w
                  ? 'bg-dark-600 border border-neon-purple/50'
                  : 'hover:bg-dark-700'
              }`}
              title={`${w}px`}
            >
              <span
                className="rounded-full bg-white"
                style={{ width: w + 2, height: w + 2 }}
              />
            </button>
          ))}

          <div className="w-px h-5 bg-dark-500 mx-1" />

          {/* Undo */}
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="text-[10px] font-bold tracking-wider text-gray-400 hover:text-neon-blue disabled:text-dark-600 transition-colors px-1"
            title="元に戻す"
          >
            UNDO
          </button>

          {/* Clear */}
          <button
            onClick={clearAll}
            disabled={strokes.length === 0}
            className="text-[10px] font-bold tracking-wider text-gray-400 hover:text-neon-pink disabled:text-dark-600 transition-colors px-1"
            title="全消去"
          >
            CLEAR
          </button>
        </div>
      )}
    </>
  );
}
