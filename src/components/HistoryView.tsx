import { useState, useMemo, useCallback } from 'react';
import {
  loadHistory,
  deleteHistoryEntry,
  updateMemo,
  clearHistory,
  type HistoryEntry,
} from '../lib/history';

interface HistoryViewProps {
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#00ff88';
  if (score >= 70) return '#00d4ff';
  if (score >= 50) return '#ffe600';
  return '#ff2d78';
}

function getScoreTextClass(score: number): string {
  if (score >= 90) return 'text-neon-green';
  if (score >= 70) return 'text-neon-blue';
  if (score >= 50) return 'text-neon-yellow';
  return 'text-neon-pink';
}

export default function HistoryView({ onClose }: HistoryViewProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const [editingMemo, setEditingMemo] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleDelete = useCallback((id: string) => {
    deleteHistoryEntry(id);
    setEntries(loadHistory());
  }, []);

  const handleClearAll = useCallback(() => {
    clearHistory();
    setEntries([]);
    setShowConfirmClear(false);
  }, []);

  const handleMemoSave = useCallback((id: string) => {
    updateMemo(id, memoText);
    setEntries(loadHistory());
    setEditingMemo(null);
  }, [memoText]);

  const startEditMemo = useCallback((entry: HistoryEntry) => {
    setEditingMemo(entry.id);
    setMemoText(entry.memo);
  }, []);

  // Score trend chart data (last 20 entries, oldest first)
  const chartData = useMemo(() => {
    return entries.slice(0, 20).reverse();
  }, [entries]);

  // Body part trend (average per body part across all entries)
  const bodyPartTrend = useMemo(() => {
    if (entries.length < 2) return null;
    const latest = entries[0];
    const prev = entries[1];
    if (!latest || !prev) return null;
    return latest.bodyPartScores.map((bp) => {
      const prevBp = prev.bodyPartScores.find((p) => p.name === bp.name);
      return {
        name: bp.nameJa,
        current: bp.score,
        previous: prevBp?.score ?? bp.score,
        diff: bp.score - (prevBp?.score ?? bp.score),
      };
    });
  }, [entries]);

  // Stats
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const scores = entries.map((e) => e.overallScore);
    const best = Math.max(...scores);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const latest = scores[0];
    const improvement = entries.length >= 2 ? latest - scores[scores.length - 1] : 0;
    return { best, avg, latest, improvement, total: entries.length };
  }, [entries]);

  // SVG chart dimensions
  const CHART_W = 600;
  const CHART_H = 160;
  const CHART_PAD = { top: 10, right: 10, bottom: 25, left: 35 };
  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const chartPath = useMemo(() => {
    if (chartData.length < 2) return '';
    const xStep = plotW / (chartData.length - 1);
    return chartData
      .map((d, i) => {
        const x = CHART_PAD.left + i * xStep;
        const y = CHART_PAD.top + plotH - (d.overallScore / 100) * plotH;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }, [chartData, plotW, plotH]);

  const chartAreaPath = useMemo(() => {
    if (chartData.length < 2) return '';
    const xStep = plotW / (chartData.length - 1);
    const points = chartData.map((d, i) => {
      const x = CHART_PAD.left + i * xStep;
      const y = CHART_PAD.top + plotH - (d.overallScore / 100) * plotH;
      return `${x},${y}`;
    });
    const bottomRight = `${CHART_PAD.left + (chartData.length - 1) * xStep},${CHART_PAD.top + plotH}`;
    const bottomLeft = `${CHART_PAD.left},${CHART_PAD.top + plotH}`;
    return `M${points.join(' L')} L${bottomRight} L${bottomLeft} Z`;
  }, [chartData, plotW, plotH]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            <span className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
              HISTORY
            </span>
          </h2>
          <p className="text-xs text-dark-500 mt-0.5">練習履歴 & スコア推移</p>
        </div>
        <div className="flex gap-2">
          {entries.length > 0 && (
            showConfirmClear ? (
              <div className="flex gap-1">
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 transition-all"
                >
                  DELETE ALL
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider bg-dark-700 text-dark-500 border border-dark-600 transition-all"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-dark-500 border border-dark-600 hover:border-neon-pink/40 hover:text-neon-pink transition-all"
              >
                CLEAR
              </button>
            )
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-dark-500 border border-dark-600 hover:border-neon-blue/40 hover:text-neon-blue transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-bold text-gray-400 mb-2">履歴がありません</h3>
          <p className="text-sm text-dark-500">
            ダンスを分析すると、結果が自動で記録されます
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2.5 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all"
          >
            START DANCING
          </button>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-dark-800 rounded-xl border border-dark-600 p-3 text-center">
                <div className="text-[10px] text-dark-500 tracking-wider mb-1">TOTAL</div>
                <div className="text-xl font-black text-gray-200 tabular-nums">{stats.total}</div>
              </div>
              <div className="bg-dark-800 rounded-xl border border-dark-600 p-3 text-center">
                <div className="text-[10px] text-dark-500 tracking-wider mb-1">BEST</div>
                <div className={`text-xl font-black tabular-nums ${getScoreTextClass(stats.best)}`}>{stats.best}</div>
              </div>
              <div className="bg-dark-800 rounded-xl border border-dark-600 p-3 text-center">
                <div className="text-[10px] text-dark-500 tracking-wider mb-1">AVERAGE</div>
                <div className={`text-xl font-black tabular-nums ${getScoreTextClass(stats.avg)}`}>{stats.avg}</div>
              </div>
              <div className="bg-dark-800 rounded-xl border border-dark-600 p-3 text-center">
                <div className="text-[10px] text-dark-500 tracking-wider mb-1">GROWTH</div>
                <div className={`text-xl font-black tabular-nums ${stats.improvement >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}>
                  {stats.improvement >= 0 ? '+' : ''}{stats.improvement}
                </div>
              </div>
            </div>
          )}

          {/* Score trend chart */}
          {chartData.length >= 2 && (
            <div className="bg-dark-800 rounded-2xl border border-dark-600 p-4 sm:p-5">
              <h3 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3">SCORE TREND</h3>
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((v) => {
                  const y = CHART_PAD.top + plotH - (v / 100) * plotH;
                  return (
                    <g key={v}>
                      <line x1={CHART_PAD.left} x2={CHART_PAD.left + plotW} y1={y} y2={y}
                        stroke="#252540" strokeWidth="1" />
                      <text x={CHART_PAD.left - 5} y={y + 4} textAnchor="end"
                        fill="#3a3a5c" fontSize="10" fontFamily="monospace">{v}</text>
                    </g>
                  );
                })}

                {/* Area fill */}
                <path d={chartAreaPath} fill="url(#trendGradient)" opacity="0.15" />

                {/* Line */}
                <path d={chartPath} fill="none" stroke="url(#trendLineGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Data points */}
                {chartData.map((d, i) => {
                  const xStep = plotW / (chartData.length - 1);
                  const x = CHART_PAD.left + i * xStep;
                  const y = CHART_PAD.top + plotH - (d.overallScore / 100) * plotH;
                  return (
                    <g key={d.id}>
                      <circle cx={x} cy={y} r="4" fill={getScoreColor(d.overallScore)} />
                      <circle cx={x} cy={y} r="6" fill={getScoreColor(d.overallScore)} opacity="0.2" />
                      {/* Date label (show every few) */}
                      {(i === 0 || i === chartData.length - 1 || chartData.length <= 8 || i % Math.ceil(chartData.length / 6) === 0) && (
                        <text x={x} y={CHART_H - 5} textAnchor="middle" fill="#3a3a5c" fontSize="9" fontFamily="monospace">
                          {formatDateShort(d.date)}
                        </text>
                      )}
                    </g>
                  );
                })}

                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="trendLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#b83dfa" />
                    <stop offset="100%" stopColor="#00d4ff" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}

          {/* Body part comparison (latest vs previous) */}
          {bodyPartTrend && (
            <div className="bg-dark-800 rounded-2xl border border-dark-600 p-4 sm:p-5">
              <h3 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3">BODY PART PROGRESS</h3>
              <div className="flex flex-col gap-2.5">
                {bodyPartTrend.map((bp) => (
                  <div key={bp.name} className="flex items-center gap-3">
                    <div className="w-12 text-xs text-gray-400 text-right">{bp.name}</div>
                    <div className="flex-1 bg-dark-700 rounded-full h-2.5 overflow-hidden relative">
                      {/* Previous score marker */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-dark-500 z-10"
                        style={{ left: `${bp.previous}%` }}
                        title={`前回: ${bp.previous}`}
                      />
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${bp.current}%`,
                          background: `linear-gradient(to right, ${getScoreColor(bp.current)}88, ${getScoreColor(bp.current)})`,
                        }}
                      />
                    </div>
                    <div className="w-8 text-right">
                      <span className={`text-sm font-bold tabular-nums ${getScoreTextClass(bp.current)}`}>
                        {bp.current}
                      </span>
                    </div>
                    <div className="w-10 text-right">
                      <span className={`text-[10px] font-bold tabular-nums ${bp.diff >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}>
                        {bp.diff >= 0 ? '+' : ''}{bp.diff}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3 text-[9px] text-dark-500 justify-center">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-dark-500 inline-block" /> 前回</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-neon-blue inline-block" /> 今回</span>
              </div>
            </div>
          )}

          {/* History list */}
          <div className="bg-dark-800 rounded-2xl border border-dark-600 p-4 sm:p-5">
            <h3 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3">ALL RECORDS</h3>
            <div className="flex flex-col gap-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-dark-700 rounded-xl p-3 border border-dark-600 hover:border-dark-500 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Score */}
                    <div className={`text-2xl font-black tabular-nums ${getScoreTextClass(entry.overallScore)} w-12 text-center`}>
                      {entry.overallScore}
                    </div>

                    {/* Body part mini bars */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-dark-500 font-mono">{formatDate(entry.date)}</span>
                        {entry.memo && (
                          <span className="text-[10px] text-gray-400 truncate">{entry.memo}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {entry.bodyPartScores.map((bp) => (
                          <div key={bp.name} className="flex-1 min-w-0">
                            <div className="bg-dark-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${bp.score}%`,
                                  backgroundColor: getScoreColor(bp.score),
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEditMemo(entry)}
                        className="w-7 h-7 rounded-lg text-dark-500 hover:text-neon-blue hover:bg-dark-600 transition-all flex items-center justify-center text-xs"
                        title="メモ編集"
                      >
                        M
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="w-7 h-7 rounded-lg text-dark-500 hover:text-neon-pink hover:bg-dark-600 transition-all flex items-center justify-center text-xs"
                        title="削除"
                      >
                        x
                      </button>
                    </div>
                  </div>

                  {/* Memo edit */}
                  {editingMemo === entry.id && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={memoText}
                        onChange={(e) => setMemoText(e.target.value)}
                        placeholder="メモを入力..."
                        className="flex-1 bg-dark-800 border border-dark-500 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-dark-500 focus:border-neon-blue/50 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleMemoSave(entry.id);
                          if (e.key === 'Escape') setEditingMemo(null);
                        }}
                      />
                      <button
                        onClick={() => handleMemoSave(entry.id)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider bg-neon-blue/20 text-neon-blue border border-neon-blue/40 transition-all"
                      >
                        SAVE
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Back button */}
      <div className="flex justify-center pb-4">
        <button
          onClick={onClose}
          className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all"
        >
          BACK
        </button>
      </div>
    </div>
  );
}
