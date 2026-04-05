import { useState, useEffect, useCallback } from 'react';
import {
  getChallenges,
  createChallenge,
  getLeaderboard,
  submitScore,
  isFirebaseConfigured,
  type Challenge,
  type ChallengeSubmission,
} from '../lib/firebase';
import type { ComparisonResult } from '../types/pose';

interface CommunityViewProps {
  onClose: () => void;
  /** Current result to submit (null if no analysis done yet) */
  currentResult: ComparisonResult | null;
}

type Tab = 'challenges' | 'create';

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-neon-green';
  if (score >= 70) return 'text-neon-blue';
  if (score >= 50) return 'text-neon-yellow';
  return 'text-neon-pink';
}

function getDifficultyStyle(d: string): { text: string; color: string; bg: string } {
  if (d === 'easy') return { text: 'EASY', color: 'text-neon-green', bg: 'bg-neon-green/10 border-neon-green/30' };
  if (d === 'hard') return { text: 'HARD', color: 'text-neon-pink', bg: 'bg-neon-pink/10 border-neon-pink/30' };
  return { text: 'MEDIUM', color: 'text-neon-yellow', bg: 'bg-neon-yellow/10 border-neon-yellow/30' };
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function daysLeft(endsAt: Date | null): string {
  if (!endsAt) return 'No limit';
  const diff = Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Ended';
  return `${diff}d left`;
}

// ─── Setup Guide (shown when Firebase is not configured) ───
function SetupGuide() {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-4">🔥</div>
      <h3 className="text-lg font-bold text-gray-300 mb-2">Firebase Setup Required</h3>
      <p className="text-sm text-dark-500 mb-6 max-w-md mx-auto">
        コミュニティ機能を使うにはFirebaseプロジェクトの設定が必要です
      </p>

      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5 max-w-lg mx-auto text-left">
        <h4 className="text-xs font-bold tracking-[0.15em] text-neon-blue mb-3">SETUP STEPS</h4>
        <ol className="flex flex-col gap-3 text-xs text-gray-400">
          <li className="flex gap-2">
            <span className="text-neon-pink font-bold shrink-0">1.</span>
            <span>
              <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-neon-blue underline">Firebase Console</a>
              でプロジェクトを作成
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-neon-pink font-bold shrink-0">2.</span>
            <span>Authentication → Anonymous sign-in を有効化</span>
          </li>
          <li className="flex gap-2">
            <span className="text-neon-pink font-bold shrink-0">3.</span>
            <span>Firestore Database を作成（本番モードまたはテストモード）</span>
          </li>
          <li className="flex gap-2">
            <span className="text-neon-pink font-bold shrink-0">4.</span>
            <span>プロジェクト設定 → Webアプリを追加 → Firebase config を取得</span>
          </li>
          <li className="flex gap-2">
            <span className="text-neon-pink font-bold shrink-0">5.</span>
            <span>プロジェクトルートに <code className="text-neon-green bg-dark-700 px-1.5 py-0.5 rounded">.env</code> ファイルを作成:</span>
          </li>
        </ol>

        <div className="bg-dark-900 rounded-lg p-3 mt-3 text-[10px] font-mono text-dark-500 overflow-x-auto">
          <div>VITE_FIREBASE_API_KEY=your-api-key</div>
          <div>VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com</div>
          <div>VITE_FIREBASE_PROJECT_ID=your-project-id</div>
          <div>VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com</div>
          <div>VITE_FIREBASE_MESSAGING_SENDER_ID=123456789</div>
          <div>VITE_FIREBASE_APP_ID=1:123:web:abc</div>
        </div>

        <p className="text-[10px] text-dark-500 mt-3">
          設定後、devサーバーを再起動してください
        </p>
      </div>
    </div>
  );
}

// ─── Leaderboard panel ───
function LeaderboardPanel({
  challenge,
  currentResult,
  onBack,
}: {
  challenge: Challenge;
  currentResult: ComparisonResult | null;
  onBack: () => void;
}) {
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState(() => localStorage.getItem('dance-user-name') || '');
  const [memo, setMemo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLeaderboard(challenge.id);
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [challenge.id]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSubmit = async () => {
    if (!currentResult || !userName.trim()) return;
    setSubmitting(true);
    try {
      localStorage.setItem('dance-user-name', userName.trim());
      await submitScore({
        challengeId: challenge.id,
        userName: userName.trim(),
        overallScore: currentResult.overallScore,
        bodyPartScores: currentResult.bodyPartScores.map((bp) => ({
          name: bp.name,
          nameJa: bp.nameJa,
          score: bp.score,
        })),
        memo,
      });
      setSubmitted(true);
      setShowSubmitForm(false);
      await fetchLeaderboard();
    } catch (err) {
      console.error('Submit failed:', err);
      alert('投稿に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const ds = getDifficultyStyle(challenge.difficulty);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="text-[10px] font-bold tracking-wider text-dark-500 hover:text-neon-blue transition-colors mb-2"
        >
          ← CHALLENGES
        </button>
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold text-gray-200">{challenge.title}</h3>
          <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${ds.bg} ${ds.color}`}>
            {ds.text}
          </span>
        </div>
        <p className="text-xs text-dark-500">{challenge.description}</p>
        <div className="flex gap-4 mt-2 text-[10px] text-dark-500">
          <span>🎵 {challenge.songName}</span>
          <span>👥 {challenge.participantCount}</span>
          <span>⏱ {daysLeft(challenge.endsAt)}</span>
        </div>
      </div>

      {/* Submit button / form */}
      {currentResult && !submitted && (
        !showSubmitForm ? (
          <button
            onClick={() => setShowSubmitForm(true)}
            className="w-full py-3 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            スコアを投稿する（{currentResult.overallScore}点）
          </button>
        ) : (
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
            <h4 className="text-xs font-bold tracking-[0.15em] text-neon-purple mb-3">SUBMIT SCORE</h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-dark-500 block mb-1">名前</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="ダンサー名を入力..."
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-dark-500 focus:border-neon-purple/50 focus:outline-none"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="text-[10px] text-dark-500 block mb-1">コメント（任意）</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="一言コメント..."
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-dark-500 focus:border-neon-purple/50 focus:outline-none"
                  maxLength={50}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!userName.trim() || submitting}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? 'POSTING...' : `POST ${currentResult.overallScore}pt`}
                </button>
                <button
                  onClick={() => setShowSubmitForm(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider bg-dark-700 text-dark-500 border border-dark-600 transition-all"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {submitted && (
        <div className="bg-neon-green/8 border border-neon-green/25 rounded-xl p-3 text-center">
          <span className="text-sm font-bold text-neon-green">投稿しました！</span>
        </div>
      )}

      {!currentResult && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-3 text-center">
          <p className="text-xs text-dark-500">ダンスを分析してからスコアを投稿できます</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-4 sm:p-5">
        <h4 className="text-xs font-bold tracking-[0.15em] text-dark-500 mb-3">LEADERBOARD</h4>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-dark-600 border-t-neon-purple animate-spin" />
            <p className="text-[10px] text-dark-500 mt-2">Loading...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-dark-500">まだ投稿がありません</p>
            <p className="text-[10px] text-dark-500 mt-1">最初の挑戦者になろう！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {submissions.map((sub, i) => {
              const isTop3 = i < 3;
              const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
              return (
                <div
                  key={sub.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                    isTop3 ? 'bg-dark-700/80 border border-dark-600' : 'bg-dark-700/40'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center shrink-0">
                    {rankEmoji ? (
                      <span className="text-lg">{rankEmoji}</span>
                    ) : (
                      <span className="text-xs text-dark-500 font-mono">{i + 1}</span>
                    )}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isTop3 ? 'text-gray-200' : 'text-gray-400'}`}>
                        {sub.userName}
                      </span>
                      {sub.memo && (
                        <span className="text-[10px] text-dark-500 truncate">{sub.memo}</span>
                      )}
                    </div>
                    {/* Mini body part bars */}
                    <div className="flex gap-0.5 mt-1">
                      {sub.bodyPartScores.map((bp) => (
                        <div key={bp.name} className="flex-1 bg-dark-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${bp.score}%`,
                              backgroundColor:
                                bp.score >= 90 ? '#00ff88' :
                                bp.score >= 70 ? '#00d4ff' :
                                bp.score >= 50 ? '#ffe600' : '#ff2d78',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Score */}
                  <div className={`text-xl font-black tabular-nums shrink-0 ${getScoreColor(sub.overallScore)}`}>
                    {sub.overallScore}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Challenge form ───
function CreateChallengeForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [songName, setSongName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [creatorName, setCreatorName] = useState(() => localStorage.getItem('dance-user-name') || '');
  const [durationDays, setDurationDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !songName.trim() || !creatorName.trim()) return;
    setCreating(true);
    try {
      localStorage.setItem('dance-user-name', creatorName.trim());
      await createChallenge({
        title: title.trim(),
        description: description.trim(),
        songName: songName.trim(),
        difficulty,
        creatorName: creatorName.trim(),
        durationDays,
      });
      onCreated();
    } catch (err) {
      console.error('Create failed:', err);
      alert('チャレンジの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <h4 className="text-xs font-bold tracking-[0.15em] text-neon-pink mb-4">NEW CHALLENGE</h4>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[10px] text-dark-500 block mb-1">チャレンジ名 *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="例: K-POP 振付チャレンジ #1" maxLength={40}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-dark-500 focus:border-neon-pink/50 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-dark-500 block mb-1">説明</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="チャレンジの説明..." maxLength={100}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-dark-500 focus:border-neon-pink/50 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-dark-500 block mb-1">曲名 *</label>
            <input type="text" value={songName} onChange={(e) => setSongName(e.target.value)}
              placeholder="曲名" maxLength={30}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-dark-500 focus:border-neon-pink/50 focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-dark-500 block mb-1">作成者名 *</label>
            <input type="text" value={creatorName} onChange={(e) => setCreatorName(e.target.value)}
              placeholder="あなたの名前" maxLength={20}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-dark-500 focus:border-neon-pink/50 focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-dark-500 block mb-1">難易度</label>
            <div className="flex gap-1.5">
              {(['easy', 'medium', 'hard'] as const).map((d) => {
                const ds = getDifficultyStyle(d);
                return (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider border transition-all ${
                      difficulty === d ? `${ds.bg} ${ds.color}` : 'bg-dark-700 text-dark-500 border-dark-600'
                    }`}>
                    {ds.text}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-dark-500 block mb-1">期間</label>
            <div className="flex gap-1.5">
              {[3, 7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDurationDays(d)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider border transition-all ${
                    durationDays === d
                      ? 'bg-neon-purple/10 text-neon-purple border-neon-purple/30'
                      : 'bg-dark-700 text-dark-500 border-dark-600'
                  }`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={!title.trim() || !songName.trim() || !creatorName.trim() || creating}
          className="w-full py-3 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {creating ? 'CREATING...' : 'CREATE CHALLENGE'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function CommunityView({ onClose, currentResult }: CommunityViewProps) {
  const [tab, setTab] = useState<Tab>('challenges');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const configured = isFirebaseConfigured();

  const fetchChallenges = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      setLoading(true);
      const data = await getChallenges();
      setChallenges(data);
    } catch (err) {
      console.error('Failed to load challenges:', err);
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">
              <span className="bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent">
                COMMUNITY
              </span>
            </h2>
            <p className="text-xs text-dark-500 mt-0.5">チャレンジ & ランキング</p>
          </div>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-dark-500 border border-dark-600 hover:border-neon-blue/40 hover:text-neon-blue transition-all">
            CLOSE
          </button>
        </div>
        <SetupGuide />
        <div className="flex justify-center pb-4">
          <button onClick={onClose}
            className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all">
            BACK
          </button>
        </div>
      </div>
    );
  }

  // Leaderboard view
  if (selectedChallenge) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">
              <span className="bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent">
                COMMUNITY
              </span>
            </h2>
          </div>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-dark-500 border border-dark-600 hover:border-neon-blue/40 hover:text-neon-blue transition-all">
            CLOSE
          </button>
        </div>
        <LeaderboardPanel
          challenge={selectedChallenge}
          currentResult={currentResult}
          onBack={() => setSelectedChallenge(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            <span className="bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent">
              COMMUNITY
            </span>
          </h2>
          <p className="text-xs text-dark-500 mt-0.5">チャレンジ & ランキング</p>
        </div>
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-dark-500 border border-dark-600 hover:border-neon-blue/40 hover:text-neon-blue transition-all">
          CLOSE
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('challenges')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all ${
            tab === 'challenges'
              ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/40'
              : 'bg-dark-700 text-dark-500 border border-dark-600'
          }`}
        >
          CHALLENGES
        </button>
        <button
          onClick={() => setTab('create')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all ${
            tab === 'create'
              ? 'bg-neon-pink/15 text-neon-pink border border-neon-pink/40'
              : 'bg-dark-700 text-dark-500 border border-dark-600'
          }`}
        >
          + CREATE
        </button>
      </div>

      {/* Challenges list */}
      {tab === 'challenges' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-dark-600 border-t-neon-purple animate-spin" />
              <p className="text-[10px] text-dark-500 mt-3">Loading challenges...</p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-lg font-bold text-gray-400 mb-2">チャレンジがありません</h3>
              <p className="text-sm text-dark-500 mb-4">最初のチャレンジを作成しましょう！</p>
              <button
                onClick={() => setTab('create')}
                className="px-6 py-2.5 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all"
              >
                CREATE CHALLENGE
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {challenges.map((ch) => {
                const ds = getDifficultyStyle(ch.difficulty);
                const ended = ch.endsAt && ch.endsAt.getTime() < Date.now();
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChallenge(ch)}
                    className={`w-full text-left bg-dark-800 rounded-xl border border-dark-600 p-4 hover:border-dark-500 transition-all ${ended ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-200">{ch.title}</span>
                          <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full border ${ds.bg} ${ds.color}`}>
                            {ds.text}
                          </span>
                          {ended && (
                            <span className="text-[9px] font-bold tracking-wider text-dark-500">ENDED</span>
                          )}
                        </div>
                        {ch.description && (
                          <p className="text-[10px] text-dark-500 mb-1.5 truncate">{ch.description}</p>
                        )}
                        <div className="flex gap-3 text-[10px] text-dark-500">
                          <span>🎵 {ch.songName}</span>
                          <span>👥 {ch.participantCount}</span>
                          <span>by {ch.creatorName}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-dark-500">{formatDate(ch.createdAt)}</div>
                        <div className={`text-[10px] font-bold ${ended ? 'text-dark-500' : 'text-neon-purple'}`}>
                          {daysLeft(ch.endsAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create tab */}
      {tab === 'create' && (
        <CreateChallengeForm
          onCreated={() => {
            setTab('challenges');
            fetchChallenges();
          }}
        />
      )}

      {/* Back button */}
      <div className="flex justify-center pb-4">
        <button onClick={onClose}
          className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all">
          BACK
        </button>
      </div>
    </div>
  );
}
