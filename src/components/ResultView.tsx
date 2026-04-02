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
    <div className="flex flex-col gap-6">
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

      {/* Timeline */}
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
        <h3 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3">TIMELINE</h3>
        <div className="flex items-end gap-px h-20">
          {result.frameDiffs.map((f, i) => (
            <div
              key={i}
              className={`flex-1 min-w-[2px] rounded-t ${getTimelineColor(f.score)}`}
              style={{ height: `${f.score}%`, opacity: 0.5 + (f.score / 100) * 0.5 }}
              title={`${Math.floor(f.time / 60)}:${String(Math.floor(f.time % 60)).padStart(2, '0')} - ${Math.round(f.score)}点`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-dark-500 mt-2 font-mono">
          <span>0:00</span>
          <span>
            {Math.floor(result.frameDiffs[result.frameDiffs.length - 1]?.time / 60 || 0)}:
            {String(Math.floor(result.frameDiffs[result.frameDiffs.length - 1]?.time % 60 || 0)).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
