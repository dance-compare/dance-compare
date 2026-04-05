import { useMemo, useState } from 'react';
import type { ComparisonResult } from '../types/pose';

interface SkillUpViewProps {
  result: ComparisonResult;
}

// ── Practice drill definitions ──
interface Drill {
  id: string;
  title: string;
  description: string;
  duration: string;
  intensity: 'light' | 'medium' | 'hard';
}

interface PracticeMenu {
  bodyPart: string;
  bodyPartJa: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
  summary: string;
  drills: Drill[];
}

// Drill database per body part
const DRILL_DB: Record<string, Drill[]> = {
  leftArm: [
    { id: 'la1', title: 'アイソレーション（左腕）', description: '肩を固定して、肘から先だけを上下左右にゆっくり動かす。鏡を見ながら正確な軌道を意識。', duration: '2分', intensity: 'light' },
    { id: 'la2', title: 'ウェーブドリル', description: '指先→手首→肘→肩の順に波を通す。逆方向も練習。滑らかな流れを意識する。', duration: '3分', intensity: 'medium' },
    { id: 'la3', title: 'ミラー練習（左右対称）', description: 'お手本と同じ動きを鏡の前で反復。左腕の可動域と角度に集中。', duration: '5分', intensity: 'medium' },
    { id: 'la4', title: 'スロー再生トレース', description: 'お手本を0.25xで再生し、左腕の動きだけを完コピ。1フレーズずつ区切って練習。', duration: '5分', intensity: 'hard' },
  ],
  rightArm: [
    { id: 'ra1', title: 'アイソレーション（右腕）', description: '肩を固定して、肘から先だけを上下左右にゆっくり動かす。鏡を見ながら正確な軌道を意識。', duration: '2分', intensity: 'light' },
    { id: 'ra2', title: 'ヒットドリル', description: '音楽のビートに合わせて右腕でヒット（止め）を入れる。止める位置の正確さを重視。', duration: '3分', intensity: 'medium' },
    { id: 'ra3', title: 'ミラー練習（左右対称）', description: 'お手本と同じ動きを鏡の前で反復。右腕の可動域と角度に集中。', duration: '5分', intensity: 'medium' },
    { id: 'ra4', title: 'スロー再生トレース', description: 'お手本を0.25xで再生し、右腕の動きだけを完コピ。1フレーズずつ区切って練習。', duration: '5分', intensity: 'hard' },
  ],
  torso: [
    { id: 'to1', title: '体幹アイソレーション', description: '胸→腰の順にアイソレーション。前後左右、円を描く動きを各方向8カウント。', duration: '3分', intensity: 'light' },
    { id: 'to2', title: 'リズムキープドリル', description: '上半身を固定してダウン/アップのリズムだけを繰り返す。音楽なしでカウントしてから音ありで。', duration: '3分', intensity: 'medium' },
    { id: 'to3', title: 'ボディウェーブ', description: '頭→胸→腰→膝の順に波を通す練習。鏡で横から見て、各部位が順番に動いているかチェック。', duration: '4分', intensity: 'medium' },
    { id: 'to4', title: 'フリーズ＆ポーズ', description: 'お手本の決めポーズで一時停止し、自分のポーズと比較。体幹の角度・重心を合わせる。', duration: '5分', intensity: 'hard' },
  ],
  leftLeg: [
    { id: 'll1', title: 'ステップ基礎（左足）', description: '左足のステップを単体で反復。着地位置・つま先の向き・膝の曲がりを確認。', duration: '2分', intensity: 'light' },
    { id: 'll2', title: 'バランスドリル', description: '左足で片足立ちしながら、右足を前後左右に出す。体幹の安定と左膝の角度を意識。', duration: '3分', intensity: 'medium' },
    { id: 'll3', title: 'フットワーク反復', description: 'お手本のステップパターンを左足メインで反復。最初はカウントで、慣れたら音楽に合わせて。', duration: '5分', intensity: 'medium' },
    { id: 'll4', title: 'スロー再生トレース', description: 'お手本を0.25xで再生し、左脚のポジションだけをトレース。重心移動のタイミングに注目。', duration: '5分', intensity: 'hard' },
  ],
  rightLeg: [
    { id: 'rl1', title: 'ステップ基礎（右足）', description: '右足のステップを単体で反復。着地位置・つま先の向き・膝の曲がりを確認。', duration: '2分', intensity: 'light' },
    { id: 'rl2', title: 'バランスドリル', description: '右足で片足立ちしながら、左足を前後左右に出す。体幹の安定と右膝の角度を意識。', duration: '3分', intensity: 'medium' },
    { id: 'rl3', title: 'フットワーク反復', description: 'お手本のステップパターンを右足メインで反復。最初はカウントで、慣れたら音楽に合わせて。', duration: '5分', intensity: 'medium' },
    { id: 'rl4', title: 'スロー再生トレース', description: 'お手本を0.25xで再生し、右脚のポジションだけをトレース。重心移動のタイミングに注目。', duration: '5分', intensity: 'hard' },
  ],
};

// General drills for overall improvement
const GENERAL_DRILLS: Drill[] = [
  { id: 'g1', title: 'ウォームアップストレッチ', description: '首・肩・腰・膝・足首を各方向にゆっくり回す。関節の可動域を広げてケガを防止。', duration: '3分', intensity: 'light' },
  { id: 'g2', title: 'リズムトレーニング', description: '音楽を聴きながらダウン/アップを交互に。手拍子でカウントを取りながら体でリズムを刻む。', duration: '3分', intensity: 'light' },
  { id: 'g3', title: 'フル通し練習', description: 'お手本を0.5xで再生しながら全体を通して踊る。細部よりも流れとリズムを重視。', duration: '5分', intensity: 'medium' },
];

// Summary message based on score
function getSummary(name: string, score: number): string {
  if (score >= 90) return `${name}はほぼ完璧！微調整でさらにレベルアップ`;
  if (score >= 75) return `${name}は良い動き。角度とタイミングを詰めよう`;
  if (score >= 60) return `${name}に改善の余地あり。基礎ドリルから始めよう`;
  if (score >= 45) return `${name}は重点改善ポイント。アイソレーションで動きを分解`;
  return `${name}は最優先で練習すべき部位。ゆっくり正確に`;
}

// Select drills based on score
function selectDrills(bodyPartName: string, score: number): Drill[] {
  const drills = DRILL_DB[bodyPartName] || [];
  if (score >= 90) return drills.slice(0, 1); // Just polish
  if (score >= 75) return drills.slice(1, 3); // Medium drills
  if (score >= 60) return drills.slice(0, 3); // Light + medium
  return drills; // All drills including hard
}

function getPriorityColor(priority: string): string {
  if (priority === 'high') return 'neon-pink';
  if (priority === 'medium') return 'neon-yellow';
  return 'neon-green';
}

function getIntensityLabel(intensity: string): { text: string; color: string } {
  if (intensity === 'hard') return { text: 'HARD', color: 'text-neon-pink' };
  if (intensity === 'medium') return { text: 'MEDIUM', color: 'text-neon-yellow' };
  return { text: 'LIGHT', color: 'text-neon-green' };
}

export default function SkillUpView({ result }: SkillUpViewProps) {
  const [expandedPart, setExpandedPart] = useState<string | null>(null);

  // Generate practice menus sorted by priority (lowest score first)
  const menus = useMemo((): PracticeMenu[] => {
    return result.bodyPartScores
      .map((bp) => ({
        bodyPart: bp.name,
        bodyPartJa: bp.nameJa,
        score: bp.score,
        priority: (bp.score < 60 ? 'high' : bp.score < 75 ? 'medium' : 'low') as PracticeMenu['priority'],
        summary: getSummary(bp.nameJa, bp.score),
        drills: selectDrills(bp.name, bp.score),
      }))
      .sort((a, b) => a.score - b.score);
  }, [result.bodyPartScores]);

  // Total practice time
  const totalTime = useMemo(() => {
    let mins = 0;
    // General drills
    for (const d of GENERAL_DRILLS.slice(0, 2)) {
      mins += parseInt(d.duration);
    }
    // Body part drills (only priority high/medium)
    for (const m of menus) {
      if (m.priority === 'low') continue;
      for (const d of m.drills) {
        mins += parseInt(d.duration);
      }
    }
    // Cool down
    mins += parseInt(GENERAL_DRILLS[2].duration);
    return mins;
  }, [menus]);

  // Recommended level for next attempt
  const recommendedLevel = useMemo(() => {
    if (result.overallScore >= 85) return { name: 'LEGEND', icon: '👑', color: 'neon-pink' };
    if (result.overallScore >= 70) return { name: 'MASTER', icon: '⭐', color: 'neon-purple' };
    if (result.overallScore >= 55) return { name: 'RISING', icon: '🔥', color: 'neon-blue' };
    return { name: 'STARTER', icon: '🌱', color: 'neon-green' };
  }, [result.overallScore]);

  const highPriorityCount = menus.filter((m) => m.priority === 'high').length;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold tracking-[0.2em] text-neon-purple mb-1">
            SKILL UP
          </h3>
          <p className="text-sm font-bold bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent">
            あなた専用の練習メニュー
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl border border-dark-600 px-3 py-2 text-center">
          <div className="text-xs text-dark-500">推定練習時間</div>
          <div className="text-lg font-black text-neon-purple tabular-nums">{totalTime}<span className="text-xs font-bold">分</span></div>
        </div>
      </div>

      {/* Priority summary */}
      {highPriorityCount > 0 && (
        <div className="bg-neon-pink/8 border border-neon-pink/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-wider text-neon-pink">FOCUS AREA</span>
          </div>
          <p className="text-sm text-gray-300">
            {menus
              .filter((m) => m.priority === 'high')
              .map((m) => m.bodyPartJa)
              .join('・')}
            の改善が最優先。基礎ドリルで動きを分解して練習しましょう。
          </p>
        </div>
      )}

      {/* Practice flow */}
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-4 sm:p-5">
        <h4 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-4">
          PRACTICE FLOW
        </h4>

        {/* Step 1: Warm up */}
        <div className="flex gap-3 mb-4">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-neon-green/20 border border-neon-green/40 flex items-center justify-center text-[10px] font-bold text-neon-green shrink-0">
              1
            </div>
            <div className="w-px flex-1 bg-dark-600 mt-1" />
          </div>
          <div className="pb-4 flex-1">
            <div className="text-sm font-bold text-neon-green mb-1">ウォームアップ</div>
            <div className="flex flex-col gap-1.5">
              {GENERAL_DRILLS.slice(0, 2).map((d) => (
                <div key={d.id} className="bg-dark-700 rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-gray-300">{d.title}</div>
                    <div className="text-[10px] text-dark-500 mt-0.5">{d.description}</div>
                  </div>
                  <span className="text-[10px] text-dark-500 font-mono shrink-0 ml-2">{d.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2: Body part drills */}
        <div className="flex gap-3 mb-4">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-neon-pink/20 border border-neon-pink/40 flex items-center justify-center text-[10px] font-bold text-neon-pink shrink-0">
              2
            </div>
            <div className="w-px flex-1 bg-dark-600 mt-1" />
          </div>
          <div className="pb-4 flex-1">
            <div className="text-sm font-bold text-neon-pink mb-1">部位別トレーニング</div>
            <div className="flex flex-col gap-2">
              {menus.map((menu) => {
                const isExpanded = expandedPart === menu.bodyPart;
                const pc = getPriorityColor(menu.priority);
                return (
                  <div
                    key={menu.bodyPart}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? `bg-${pc}/5 border-${pc}/30`
                        : 'bg-dark-700 border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedPart(isExpanded ? null : menu.bodyPart)}
                      className="w-full p-3 flex items-center gap-3 text-left"
                    >
                      {/* Priority indicator */}
                      <div
                        className={`w-2 h-2 rounded-full shrink-0`}
                        style={{
                          backgroundColor:
                            menu.priority === 'high' ? '#ff2d78' :
                            menu.priority === 'medium' ? '#ffe600' : '#00ff88',
                        }}
                      />
                      {/* Body part name & score */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-300">{menu.bodyPartJa}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full`}
                            style={{
                              backgroundColor:
                                menu.priority === 'high' ? 'rgba(255,45,120,0.15)' :
                                menu.priority === 'medium' ? 'rgba(255,230,0,0.15)' : 'rgba(0,255,136,0.15)',
                              color:
                                menu.priority === 'high' ? '#ff2d78' :
                                menu.priority === 'medium' ? '#ffe600' : '#00ff88',
                            }}
                          >
                            {menu.priority === 'high' ? '要改善' : menu.priority === 'medium' ? '改善推奨' : 'Good'}
                          </span>
                        </div>
                        <div className="text-[10px] text-dark-500 mt-0.5">{menu.summary}</div>
                      </div>
                      {/* Score */}
                      <span className={`text-sm font-black tabular-nums shrink-0 ${
                        menu.score >= 90 ? 'text-neon-green' :
                        menu.score >= 70 ? 'text-neon-blue' :
                        menu.score >= 50 ? 'text-neon-yellow' : 'text-neon-pink'
                      }`}>
                        {menu.score}
                      </span>
                      {/* Expand arrow */}
                      <span className={`text-dark-500 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        →
                      </span>
                    </button>

                    {/* Expanded drills */}
                    {isExpanded && (
                      <div className="px-3 pb-3 flex flex-col gap-1.5">
                        {menu.drills.map((drill) => {
                          const il = getIntensityLabel(drill.intensity);
                          return (
                            <div key={drill.id} className="bg-dark-800/80 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-200">{drill.title}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[9px] font-bold tracking-wider ${il.color}`}>{il.text}</span>
                                  <span className="text-[10px] text-dark-500 font-mono">{drill.duration}</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-dark-500 leading-relaxed">{drill.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 3: Full run */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-neon-blue/20 border border-neon-blue/40 flex items-center justify-center text-[10px] font-bold text-neon-blue shrink-0">
              3
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-neon-blue mb-1">通し練習</div>
            <div className="bg-dark-700 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-300">{GENERAL_DRILLS[2].title}</div>
                <div className="text-[10px] text-dark-500 mt-0.5">{GENERAL_DRILLS[2].description}</div>
              </div>
              <span className="text-[10px] text-dark-500 font-mono shrink-0 ml-2">{GENERAL_DRILLS[2].duration}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Next step recommendation */}
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-4 sm:p-5">
        <h4 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3">NEXT STEP</h4>
        <div className="flex items-center gap-4">
          <div className="text-3xl">{recommendedLevel.icon}</div>
          <div>
            <div className="text-sm font-bold text-gray-200 mb-0.5">
              練習後にもう一度撮影して比較しよう
            </div>
            <div className="text-xs text-dark-500">
              レッスンモードは
              <span className={`font-bold text-${recommendedLevel.color} mx-1`}>
                {recommendedLevel.name}
              </span>
              レベルがおすすめ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
