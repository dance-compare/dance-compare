import { useState, useMemo } from 'react';
import type { ComparisonResult } from '../types/pose';

interface ResultViewProps {
  result: ComparisonResult;
}

function getScoreGradient(score: number): string {
  if (score >= 90) return 'from-neon-green to-neon-blue';
  if (score >= 70) return 'from-neon-blue to-neon-purple';
  if (score >= 50) return 'from-neon-yellow to-neon-pink';
  return 'from-neon-pink to-red-500';
}

function getScoreGlow(score: number): string {
  if (score >= 90) return 'text-glow-green';
  if (score >= 70) return 'text-glow-blue';
  return 'text-glow-pink';
}

function getScoreLabel(score: number): string {
  if (score >= 95) return 'PERFECT!';
  if (score >= 90) return 'AMAZING!';
  if (score >= 80) return 'GREAT!';
  if (score >= 70) return 'GOOD!';
  if (score >= 60) return 'NICE TRY!';
  if (score >= 50) return 'KEEP GOING!';
  return 'PRACTICE MORE!';
}

function getBarGradient(score: number): string {
  if (score >= 90) return 'bg-gradient-to-r from-neon-green to-neon-blue';
  if (score >= 70) return 'bg-gradient-to-r from-neon-blue to-neon-purple';
  if (score >= 50) return 'bg-gradient-to-r from-neon-yellow to-neon-pink';
  return 'bg-gradient-to-r from-neon-pink to-red-500';
}

function getTimelineColor(score: number): string {
  if (score >= 90) return 'bg-neon-green';
  if (score >= 70) return 'bg-neon-blue';
  if (score >= 50) return 'bg-neon-yellow';
  return 'bg-neon-pink';
}

function TimelineSection({ frameDiffs }: { frameDiffs: ComparisonResult['frameDiffs'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute section averages (split into quarters)
  const sectionStats = useMemo(() => {
    if (frameDiffs.length === 0) return [];
    const sectionCount = Math.min(4, frameDiffs.length);
    const sectionSize = Math.ceil(frameDiffs.length / sectionCount);
    const sections = [];
    for (let i = 0; i < sectionCount; i++) {
      const start = i * sectionSize;
      const end = Math.min(start + sectionSize, frameDiffs.length);
      const slice = frameDiffs.slice(start, end);
      const avg = Math.round(slice.reduce((s, f) => s + f.score, 0) / slice.length);
      const startTime = frameDiffs[start].time;
      const endTime = frameDiffs[end - 1].time;
      sections.push({ avg, startTime, endTime });
    }
    return sections;
  }, [frameDiffs]);

  // Score distribution
  const distribution = useMemo(() => {
    const counts = { excellent: 0, good: 0, fair: 0, poor: 0 };
    for (const f of frameDiffs) {
      if (f.score >= 90) counts.excellent++;
      else if (f.score >= 70) counts.good++;
      else if (f.score >= 50) counts.fair++;
      else counts.poor++;
    }
    const total = frameDiffs.length || 1;
    return {
      excellent: Math.round((counts.excellent / total) * 100),
      good: Math.round((counts.good / total) * 100),
      fair: Math.round((counts.fair / total) * 100),
      poor: Math.round((counts.poor / total) * 100),
    };
  }, [frameDiffs]);

  const hoveredFrame = hoveredIdx !== null ? frameDiffs[hoveredIdx] : null;

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-3 sm:p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold tracking-[0.15em] text-dark-500">TIMELINE</h3>
        {hoveredFrame ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-dark-500">
              {Math.floor(hoveredFrame.time / 60)}:{String(Math.floor(hoveredFrame.time % 60)).padStart(2, '0')}
            </span>
            <span className={`text-sm font-bold tabular-nums ${
              hoveredFrame.score >= 90 ? 'text-neon-green' :
              hoveredFrame.score >= 70 ? 'text-neon-blue' :
              hoveredFrame.score >= 50 ? 'text-neon-yellow' : 'text-neon-pink'
            }`}>
              {Math.round(hoveredFrame.score)}%
            </span>
            {hoveredFrame.worstParts.length > 0 && (
              <span className="text-[10px] text-dark-500">
                {hoveredFrame.worstParts.join(', ')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-dark-500">hover for details</span>
        )}
      </div>

      {/* Timeline bars */}
      <div
        className="flex items-end h-20 sm:h-24 gap-px rounded overflow-hidden"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {frameDiffs.map((f, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className="flex-1 min-w-0 rounded-t-sm transition-all cursor-pointer"
              style={{
                height: `${f.score}%`,
                opacity: hoveredIdx !== null ? (isHovered ? 1 : 0.3) : 0.5 + (f.score / 100) * 0.5,
                backgroundColor:
                  f.score >= 90 ? '#00ff88' :
                  f.score >= 70 ? '#00d4ff' :
                  f.score >= 50 ? '#ffe600' : '#ff2d78',
                transform: isHovered ? 'scaleX(2.5)' : 'scaleX(1)',
              }}
              onMouseEnter={() => setHoveredIdx(i)}
            />
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-[10px] text-dark-500 mt-2 font-mono">
        <span>0:00</span>
        <span>
          {frameDiffs.length > 0
            ? `${Math.floor(frameDiffs[frameDiffs.length - 1].time / 60)}:${String(Math.floor(frameDiffs[frameDiffs.length - 1].time % 60)).padStart(2, '0')}`
            : '0:00'}
        </span>
      </div>

      {/* Section averages */}
      {sectionStats.length > 0 && (
        <div className="grid gap-2 mt-4" style={{ gridTemplateColumns: `repeat(${sectionStats.length}, 1fr)` }}>
          {sectionStats.map((sec, i) => (
            <div key={i} className="bg-dark-700 rounded-lg p-2 text-center">
              <div className={`text-base sm:text-lg font-black tabular-nums ${
                sec.avg >= 90 ? 'text-neon-green' :
                sec.avg >= 70 ? 'text-neon-blue' :
                sec.avg >= 50 ? 'text-neon-yellow' : 'text-neon-pink'
              }`}>
                {sec.avg}%
              </div>
              <div className="text-[9px] text-dark-500 font-mono mt-0.5">
                {Math.floor(sec.startTime / 60)}:{String(Math.floor(sec.startTime % 60)).padStart(2, '0')}
                {' - '}
                {Math.floor(sec.endTime / 60)}:{String(Math.floor(sec.endTime % 60)).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Score distribution bar */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-bold tracking-[0.1em] text-dark-500">DISTRIBUTION</span>
        </div>
        <div className="flex h-2.5 rounded-full overflow-hidden">
          {distribution.excellent > 0 && (
            <div className="bg-neon-green transition-all" style={{ width: `${distribution.excellent}%` }} />
          )}
          {distribution.good > 0 && (
            <div className="bg-neon-blue transition-all" style={{ width: `${distribution.good}%` }} />
          )}
          {distribution.fair > 0 && (
            <div className="bg-neon-yellow transition-all" style={{ width: `${distribution.fair}%` }} />
          )}
          {distribution.poor > 0 && (
            <div className="bg-neon-pink transition-all" style={{ width: `${distribution.poor}%` }} />
          )}
        </div>
        <div className="flex gap-3 mt-2 justify-center flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-dark-500">
            <span className="w-2 h-2 rounded-full bg-neon-green" />
            90%+ ({distribution.excellent}%)
          </span>
          <span className="flex items-center gap-1 text-[10px] text-dark-500">
            <span className="w-2 h-2 rounded-full bg-neon-blue" />
            70-89% ({distribution.good}%)
          </span>
          <span className="flex items-center gap-1 text-[10px] text-dark-500">
            <span className="w-2 h-2 rounded-full bg-neon-yellow" />
            50-69% ({distribution.fair}%)
          </span>
          <span className="flex items-center gap-1 text-[10px] text-dark-500">
            <span className="w-2 h-2 rounded-full bg-neon-pink" />
            &lt;50% ({distribution.poor}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ResultView({ result }: ResultViewProps) {
  const lowScoreFrames = result.frameDiffs
    .filter((f) => f.score < 60)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  // SVG circle params for score ring
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (result.overallScore / 100) * circumference;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 overflow-hidden">
      {/* Overall score with ring */}
      <div className="flex flex-col items-center py-6 sm:py-8">
        <div className="relative w-32 h-32 sm:w-40 sm:h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#1a1a2e" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={`animate-score-fill`}
              style={{
                stroke: 'url(#scoreGradient)',
                strokeDasharray: circumference,
                strokeDashoffset: offset,
              }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={result.overallScore >= 70 ? '#00ff88' : '#ff2d78'} />
                <stop offset="100%" stopColor={result.overallScore >= 70 ? '#00d4ff' : '#b83dfa'} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl sm:text-4xl font-black bg-gradient-to-b ${getScoreGradient(result.overallScore)} bg-clip-text text-transparent ${getScoreGlow(result.overallScore)}`}>
              {result.overallScore}
            </span>
            <span className="text-[10px] text-dark-500 tracking-widest">SCORE</span>
          </div>
        </div>
        <div className={`mt-3 text-lg font-bold tracking-wider bg-gradient-to-r ${getScoreGradient(result.overallScore)} bg-clip-text text-transparent`}>
          {getScoreLabel(result.overallScore)}
        </div>
      </div>

      {/* Body part scores */}
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-3 sm:p-5">
        <h3 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3 sm:mb-4">BODY PARTS</h3>
        <div className="flex flex-col gap-3">
          {result.bodyPartScores.map((bp) => (
            <div key={bp.name} className="flex items-center gap-3">
              <div className="w-14 text-xs text-gray-400 text-right">{bp.nameJa}</div>
              <div className="flex-1 bg-dark-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${getBarGradient(bp.score)}`}
                  style={{ width: `${bp.score}%` }}
                />
              </div>
              <div className={`w-10 text-right text-sm font-bold bg-gradient-to-r ${getScoreGradient(bp.score)} bg-clip-text text-transparent`}>
                {bp.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dance Advice */}
      {result.advices && result.advices.length > 0 && (
        <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
          <h3 className="text-xs font-bold tracking-[0.15em] text-neon-purple mb-4">
            ADVICE - ここを改善しよう！
          </h3>
          <div className="flex flex-col gap-3">
            {result.advices.map((adv, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border transition-all ${
                  adv.severity === 'high'
                    ? 'bg-neon-pink/8 border-neon-pink/30'
                    : adv.severity === 'medium'
                    ? 'bg-neon-yellow/8 border-neon-yellow/30'
                    : 'bg-neon-blue/8 border-neon-blue/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{adv.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        adv.severity === 'high'
                          ? 'bg-neon-pink/20 text-neon-pink'
                          : adv.severity === 'medium'
                          ? 'bg-neon-yellow/20 text-neon-yellow'
                          : 'bg-neon-blue/20 text-neon-blue'
                      }`}>
                        {adv.bodyPart}
                      </span>
                      {adv.severity === 'high' && (
                        <span className="text-[10px] font-bold text-neon-pink tracking-wider">
                          要改善
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-200 mb-1">
                      {adv.message}
                    </p>
                    <p className="text-xs text-gray-400 mb-1">
                      {adv.detail}
                    </p>
                    <p className="text-[10px] text-dark-500 font-mono">
                      {adv.timeHint}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak points */}
      {lowScoreFrames.length > 0 && (
        <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
          <h3 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3">IMPROVE</h3>
          <div className="flex flex-col gap-2">
            {lowScoreFrames.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2.5 bg-neon-pink/5 border border-neon-pink/20 rounded-xl text-sm"
              >
                <span className="text-dark-500 text-xs w-12 font-mono">
                  {Math.floor(f.time / 60)}:{String(Math.floor(f.time % 60)).padStart(2, '0')}
                </span>
                <span className="text-neon-pink font-bold text-xs">
                  {Math.round(f.score)}pt
                </span>
                {f.worstParts.length > 0 && (
                  <span className="text-gray-400 text-xs">
                    {f.worstParts.join(' / ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Timeline */}
      <TimelineSection frameDiffs={result.frameDiffs} />
    </div>
  );
}
