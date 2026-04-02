import { useState, useRef, useCallback } from 'react';
import VideoInput from './components/VideoInput';
import VideoPlayer from './components/VideoPlayer';
import ResultView from './components/ResultView';
import OverlayView from './components/OverlayView';
import LessonView from './components/LessonView';
import { extractPoseFromVideo } from './lib/poseEstimation';
import { compareDances } from './lib/comparison';
import { findMatchingStart } from './lib/findMatchStart';
import type { PoseData, ComparisonResult } from './types/pose';

type AppState = 'input' | 'analyzing' | 'result';

function App() {
  const [state, setState] = useState<AppState>('input');
  const [progress, setProgress] = useState({ ref: 0, user: 0, phase: '' });
  const [refPose, setRefPose] = useState<PoseData | null>(null);
  const [userPose, setUserPose] = useState<PoseData | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [refReady, setRefReady] = useState(false);
  const [userReady, setUserReady] = useState(false);
  const [refVideoUrl, setRefVideoUrl] = useState<string | null>(null);
  const [userVideoUrl, setUserVideoUrl] = useState<string | null>(null);
  const [refStartTime, setRefStartTime] = useState(0);
  const [userStartTime, setUserStartTime] = useState(0);

  const refVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);

  const handleRefVideoReady = useCallback((url: string) => {
    setRefReady(true);
    setRefVideoUrl(url);
  }, []);
  const handleUserVideoReady = useCallback((url: string) => {
    setUserReady(true);
    setUserVideoUrl(url);
  }, []);

  const startAnalysis = useCallback(async () => {
    const refVideo = refVideoRef.current;
    const userVideo = userVideoRef.current;
    if (!refVideo || !userVideo) return;

    setState('analyzing');
    setProgress({ ref: 0, user: 0, phase: '音楽の開始地点を検出中...' });

    try {
      // Step 1: Extract poses from both full videos
      setProgress((prev) => ({ ...prev, phase: 'お手本の骨格を検出中...' }));
      const refData = await extractPoseFromVideo(refVideo, (p) =>
        setProgress((prev) => ({ ...prev, ref: p }))
      );

      setProgress((prev) => ({ ...prev, phase: 'あなたの骨格を検出中...' }));
      const userData = await extractPoseFromVideo(userVideo, (p) =>
        setProgress((prev) => ({ ...prev, user: p }))
      );

      // Step 2: Find where the same choreography starts using DTW matching
      setProgress((prev) => ({ ...prev, phase: '同じ動きの開始地点を検出中...' }));
      const { refStartFrame, userStartFrame } = findMatchingStart(refData, userData);

      const refStartSec = refStartFrame / refData.fps;
      const userStartSec = userStartFrame / userData.fps;
      console.log(`Matched start: ref=${refStartSec.toFixed(2)}s (frame ${refStartFrame}), user=${userStartSec.toFixed(2)}s (frame ${userStartFrame})`);

      // Step 3: Trim both to start from matched point
      const trimmedRef: PoseData = {
        ...refData,
        frames: refData.frames.slice(refStartFrame),
        duration: refData.duration - refStartSec,
      };
      const trimmedUser: PoseData = {
        ...userData,
        frames: userData.frames.slice(userStartFrame),
        duration: userData.duration - userStartSec,
      };

      setRefPose(trimmedRef);
      setUserPose(trimmedUser);

      // Step 4: Compare the aligned sequences
      setProgress((prev) => ({ ...prev, phase: 'スコアを計算中...' }));
      const compResult = compareDances(trimmedRef, trimmedUser);
      setResult(compResult);

      // Save start times for playback
      setRefStartTime(refStartSec);
      setUserStartTime(userStartSec);

      refVideo.currentTime = refStartSec;
      userVideo.currentTime = userStartSec;

      setState('result');
    } catch (err) {
      console.error('Analysis failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`解析中にエラーが発生しました:\n${msg}\n\nもう一度お試しください。`);
      setState('input');
    }
  }, []);

  const reset = useCallback(() => {
    setState('input');
    setRefPose(null);
    setUserPose(null);
    setResult(null);
    setRefReady(false);
    setUserReady(false);
    setRefVideoUrl(null);
    setUserVideoUrl(null);
  }, []);

  return (
    <div className="bg-dance">
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-800/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center text-xl glow-pink">
              D
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue bg-clip-text text-transparent">
                DANCE SCORE
              </h1>
              <p className="text-[10px] text-dark-500 tracking-widest uppercase">Compare & Improve</p>
            </div>
          </div>
          {state === 'result' && (
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg border border-dark-500 text-sm text-gray-400 hover:border-neon-pink hover:text-neon-pink transition-all"
            >
              New Session
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hidden persistent video elements */}
        <div className={state === 'input' ? '' : 'hidden'}>
          <div className="flex flex-col gap-8">
            <div className="text-center py-6">
              <h2 className="text-3xl font-bold mb-3">
                <span className="bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent text-glow-pink">
                  Level Up
                </span>
                {' '}Your Dance
              </h2>
              <p className="text-dark-500 text-sm">
                お手本とあなたのダンスをAIが比較・採点
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <VideoInput
                label="REFERENCE"
                sublabel="お手本動画"
                accentColor="green"
                onVideoReady={handleRefVideoReady}
                videoRef={refVideoRef}
              />
              <VideoInput
                label="YOUR DANCE"
                sublabel="あなたの動画"
                accentColor="blue"
                onVideoReady={handleUserVideoReady}
                videoRef={userVideoRef}
              />
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={startAnalysis}
                disabled={!refReady || !userReady}
                className={`group relative px-10 py-4 rounded-2xl text-lg font-bold tracking-wide transition-all duration-300 ${
                  refReady && userReady
                    ? 'bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue text-white glow-pink hover:scale-105 active:scale-95'
                    : 'bg-dark-700 text-dark-500 cursor-not-allowed'
                }`}
              >
                {refReady && userReady ? (
                  <>
                    <span className="relative z-10">ANALYZE</span>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue opacity-0 group-hover:opacity-30 blur-xl transition-opacity" />
                  </>
                ) : (
                  '動画を2つ選択してください'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Analyzing state */}
        {state === 'analyzing' && (
          <div className="flex flex-col items-center gap-8 py-20">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-dark-600" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-neon-pink border-r-neon-purple animate-spin-slow" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-neon-blue border-l-neon-green animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">AI</span>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-bold bg-gradient-to-r from-neon-pink to-neon-blue bg-clip-text text-transparent mb-2">
                Analyzing Your Dance...
              </h3>
              <p className="text-dark-500 text-sm">{progress.phase || '骨格を検出して動きを比較しています'}</p>
            </div>

            <div className="w-full max-w-md flex flex-col gap-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neon-green text-glow-green">REFERENCE</span>
                  <span className="text-gray-400">{Math.round(progress.ref)}%</span>
                </div>
                <div className="bg-dark-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon-green to-neon-blue transition-all duration-300"
                    style={{ width: `${progress.ref}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neon-blue text-glow-blue">YOUR DANCE</span>
                  <span className="text-gray-400">{Math.round(progress.user)}%</span>
                </div>
                <div className="bg-dark-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all duration-300"
                    style={{ width: `${progress.user}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Result state */}
        {state === 'result' && result && refPose && userPose && (
          <div className="flex flex-col gap-8">
            <ResultView result={result} />
            <LessonView
              userPose={userPose}
              refPose={refPose}
              result={result}
              userVideoUrl={userVideoUrl}
              userStartTime={userStartTime}
            />
            <OverlayView
              refPose={refPose}
              userPose={userPose}
              refStartTime={refStartTime}
              userStartTime={userStartTime}
              refVideoUrl={refVideoUrl}
              userVideoUrl={userVideoUrl}
            />
            <VideoPlayer
              refVideoUrl={refVideoUrl}
              userVideoUrl={userVideoUrl}
              refPose={refPose}
              userPose={userPose}
              result={result}
              refStartTime={refStartTime}
              userStartTime={userStartTime}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-dark-700 mt-16 py-6 text-center text-dark-500 text-xs">
        DANCE SCORE - Powered by MediaPipe AI
      </footer>
    </div>
  );
}

export default App;
