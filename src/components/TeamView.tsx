import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  isFirebaseConfigured,
  createTeam,
  getMyTeams,
  joinTeam,
  getTeamMembers,
  getTeamScores,
  submitTeamScore,
} from '../lib/firebase';
import type { Team, TeamMember, TeamScore } from '../lib/firebase';
import type { ComparisonResult } from '../types/pose';

interface TeamViewProps {
  onClose: () => void;
  currentResult: ComparisonResult | null;
}

// ── Score color helper ──
function scoreColor(s: number): string {
  if (s >= 90) return 'text-neon-green';
  if (s >= 75) return 'text-neon-blue';
  if (s >= 60) return 'text-neon-purple';
  return 'text-neon-pink';
}

function scoreBg(s: number): string {
  if (s >= 90) return 'bg-neon-green';
  if (s >= 75) return 'bg-neon-blue';
  if (s >= 60) return 'bg-neon-purple';
  return 'bg-neon-pink';
}

// ── Setup Guide (same pattern as CommunityView) ──
function SetupGuide() {
  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-6 max-w-lg mx-auto">
      <h3 className="text-sm font-bold text-neon-orange mb-3">Firebase Setup Required</h3>
      <p className="text-xs text-dark-500 mb-4">
        チーム機能を使うにはFirebaseの設定が必要です。
        プロジェクトルートに <code className="text-neon-blue">.env</code> ファイルを作成してください。
      </p>
      <div className="bg-dark-900 rounded-lg p-3 text-[10px] font-mono text-dark-500 leading-relaxed">
        VITE_FIREBASE_API_KEY=...<br />
        VITE_FIREBASE_AUTH_DOMAIN=...<br />
        VITE_FIREBASE_PROJECT_ID=...<br />
        VITE_FIREBASE_STORAGE_BUCKET=...<br />
        VITE_FIREBASE_MESSAGING_SENDER_ID=...<br />
        VITE_FIREBASE_APP_ID=...
      </div>
    </div>
  );
}

// ── Create Team Form ──
function CreateTeamForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructorName, setInstructorName] = useState(
    () => localStorage.getItem('dance-score-userName') || ''
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !instructorName.trim()) return;
    setLoading(true);
    try {
      await createTeam({ name: name.trim(), description: description.trim(), instructorName: instructorName.trim() });
      localStorage.setItem('dance-score-userName', instructorName.trim());
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 flex flex-col gap-3">
      <h4 className="text-xs font-bold tracking-[0.15em] text-neon-green">CREATE TEAM</h4>
      <input
        type="text"
        placeholder="チーム名 / スクール名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:border-neon-green/50 outline-none"
      />
      <input
        type="text"
        placeholder="説明（任意）"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:border-neon-green/50 outline-none"
      />
      <input
        type="text"
        placeholder="あなたの名前（指導者名）"
        value={instructorName}
        onChange={(e) => setInstructorName(e.target.value)}
        className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:border-neon-green/50 outline-none"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !name.trim() || !instructorName.trim()}
        className="py-2.5 rounded-lg text-xs font-bold tracking-wider bg-gradient-to-r from-neon-green to-neon-blue text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
      >
        {loading ? '作成中...' : 'チームを作成'}
      </button>
    </div>
  );
}

// ── Join Team Form ──
function JoinTeamForm({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('');
  const [userName, setUserName] = useState(
    () => localStorage.getItem('dance-score-userName') || ''
  );
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim() || !userName.trim()) return;
    setLoading(true);
    try {
      await joinTeam(code.trim(), userName.trim());
      localStorage.setItem('dance-score-userName', userName.trim());
      onJoined();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 flex flex-col gap-3">
      <h4 className="text-xs font-bold tracking-[0.15em] text-neon-blue">JOIN TEAM</h4>
      <input
        type="text"
        placeholder="参加コード（6文字）"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        maxLength={6}
        className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:border-neon-blue/50 outline-none tracking-[0.3em] text-center font-mono"
      />
      <input
        type="text"
        placeholder="あなたの名前"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:border-neon-blue/50 outline-none"
      />
      <button
        onClick={handleJoin}
        disabled={loading || code.length < 6 || !userName.trim()}
        className="py-2.5 rounded-lg text-xs font-bold tracking-wider bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
      >
        {loading ? '参加中...' : 'チームに参加'}
      </button>
    </div>
  );
}

// ── Member Progress Card ──
function MemberCard({
  member,
  scores,
  isInstructor,
}: {
  member: TeamMember;
  scores: TeamScore[];
  isInstructor: boolean;
}) {
  const memberScores = scores.filter((s) => s.userId === member.userId);
  const latest = memberScores[0];
  const best = memberScores.length > 0
    ? memberScores.reduce((a, b) => (a.overallScore > b.overallScore ? a : b))
    : null;
  const avg = memberScores.length > 0
    ? Math.round(memberScores.reduce((sum, s) => sum + s.overallScore, 0) / memberScores.length)
    : 0;

  // Growth: compare latest to first
  const first = memberScores.length > 1 ? memberScores[memberScores.length - 1] : null;
  const growth = latest && first ? latest.overallScore - first.overallScore : 0;

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            member.role === 'instructor'
              ? 'bg-neon-orange/20 text-neon-orange border border-neon-orange/30'
              : 'bg-dark-600 text-gray-400'
          }`}>
            {member.userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold">{member.userName}</div>
            <div className="text-[10px] text-dark-500">
              {member.role === 'instructor' ? 'Instructor' : 'Student'}
              {' / '}
              {memberScores.length} sessions
            </div>
          </div>
        </div>
        {latest && (
          <div className={`text-2xl font-black ${scoreColor(latest.overallScore)}`}>
            {latest.overallScore}
          </div>
        )}
      </div>

      {memberScores.length > 0 ? (
        <div className="flex flex-col gap-2">
          {/* Stats row */}
          <div className="flex gap-2 text-[10px]">
            <div className="flex-1 bg-dark-700 rounded-lg px-2 py-1.5 text-center">
              <div className="text-dark-500">Best</div>
              <div className={`font-bold ${scoreColor(best!.overallScore)}`}>{best!.overallScore}</div>
            </div>
            <div className="flex-1 bg-dark-700 rounded-lg px-2 py-1.5 text-center">
              <div className="text-dark-500">Avg</div>
              <div className="font-bold text-gray-300">{avg}</div>
            </div>
            <div className="flex-1 bg-dark-700 rounded-lg px-2 py-1.5 text-center">
              <div className="text-dark-500">Growth</div>
              <div className={`font-bold ${growth > 0 ? 'text-neon-green' : growth < 0 ? 'text-neon-pink' : 'text-gray-500'}`}>
                {growth > 0 ? '+' : ''}{growth}
              </div>
            </div>
          </div>

          {/* Body part bars for latest score (instructor view) */}
          {isInstructor && latest.bodyPartScores.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {latest.bodyPartScores.map((bp) => (
                <div key={bp.name} className="flex items-center gap-2">
                  <span className="text-[9px] text-dark-500 w-14 truncate">{bp.nameJa}</span>
                  <div className="flex-1 bg-dark-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreBg(bp.score)}`}
                      style={{ width: `${bp.score}%`, opacity: 0.7 }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 w-6 text-right">{bp.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-dark-500 text-center py-2">
          まだスコアの提出がありません
        </div>
      )}
    </div>
  );
}

// ── Team Detail Panel ──
function TeamDetail({
  team,
  currentResult,
  onBack,
}: {
  team: Team;
  currentResult: ComparisonResult | null;
  onBack: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'latest' | 'best'>('latest');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([getTeamMembers(team.id), getTeamScores(team.id)]);
      setMembers(m);
      setScores(s);
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  }, [team.id]);

  useEffect(() => { load(); }, [load]);

  // Check if current user is instructor
  const isInstructor = useMemo(() => {
    const uid = localStorage.getItem('dance-score-userId');
    return members.some((m) => m.userId === uid && m.role === 'instructor') ||
      members.some((m) => m.role === 'instructor'); // fallback: show instructor view if any instructor exists
  }, [members]);

  // Sort members
  const sortedMembers = useMemo(() => {
    const sorted = [...members];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.userName.localeCompare(b.userName));
    } else if (sortBy === 'latest') {
      sorted.sort((a, b) => {
        const aScore = scores.find((s) => s.userId === a.userId)?.overallScore ?? -1;
        const bScore = scores.find((s) => s.userId === b.userId)?.overallScore ?? -1;
        return bScore - aScore;
      });
    } else if (sortBy === 'best') {
      sorted.sort((a, b) => {
        const aScores = scores.filter((s) => s.userId === a.userId);
        const bScores = scores.filter((s) => s.userId === b.userId);
        const aBest = aScores.length > 0 ? Math.max(...aScores.map((s) => s.overallScore)) : -1;
        const bBest = bScores.length > 0 ? Math.max(...bScores.map((s) => s.overallScore)) : -1;
        return bBest - aBest;
      });
    }
    return sorted;
  }, [members, scores, sortBy]);

  // Team-wide stats
  const teamStats = useMemo(() => {
    if (scores.length === 0) return null;
    const avgScore = Math.round(scores.reduce((s, sc) => s + sc.overallScore, 0) / scores.length);
    const bestScore = Math.max(...scores.map((s) => s.overallScore));
    const activeMembers = new Set(scores.map((s) => s.userId)).size;
    return { avgScore, bestScore, activeMembers, totalSessions: scores.length };
  }, [scores]);

  const handleSubmitScore = async () => {
    if (!currentResult) return;
    const userName = localStorage.getItem('dance-score-userName') || 'Anonymous';
    setSubmitting(true);
    try {
      await submitTeamScore({
        teamId: team.id,
        userName,
        overallScore: currentResult.overallScore,
        bodyPartScores: currentResult.bodyPartScores,
        memo: '',
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-dark-600 border-t-neon-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg border border-dark-600 text-dark-500 hover:text-neon-orange hover:border-neon-orange/50 transition-all flex items-center justify-center text-sm"
        >
          &lt;
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-bold">{team.name}</h3>
          <div className="text-[10px] text-dark-500">
            {team.instructorName} / {team.memberCount} members
          </div>
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider border transition-all ${
            showCode
              ? 'bg-neon-orange/20 text-neon-orange border-neon-orange/50'
              : 'border-dark-500 text-dark-500 hover:border-neon-orange hover:text-neon-orange'
          }`}
        >
          CODE
        </button>
      </div>

      {/* Join code display */}
      {showCode && (
        <div className="bg-dark-800 rounded-xl border border-neon-orange/30 p-4 text-center">
          <div className="text-[10px] text-dark-500 mb-2">
            このコードを生徒に共有してチームに招待
          </div>
          <div className="text-3xl font-black tracking-[0.4em] text-neon-orange font-mono">
            {team.joinCode}
          </div>
        </div>
      )}

      {/* Team stats */}
      {teamStats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-dark-800 rounded-lg border border-dark-600 p-2.5 text-center">
            <div className="text-[9px] text-dark-500 tracking-wider">AVG</div>
            <div className={`text-lg font-black ${scoreColor(teamStats.avgScore)}`}>
              {teamStats.avgScore}
            </div>
          </div>
          <div className="bg-dark-800 rounded-lg border border-dark-600 p-2.5 text-center">
            <div className="text-[9px] text-dark-500 tracking-wider">BEST</div>
            <div className={`text-lg font-black ${scoreColor(teamStats.bestScore)}`}>
              {teamStats.bestScore}
            </div>
          </div>
          <div className="bg-dark-800 rounded-lg border border-dark-600 p-2.5 text-center">
            <div className="text-[9px] text-dark-500 tracking-wider">ACTIVE</div>
            <div className="text-lg font-black text-gray-300">
              {teamStats.activeMembers}
            </div>
          </div>
          <div className="bg-dark-800 rounded-lg border border-dark-600 p-2.5 text-center">
            <div className="text-[9px] text-dark-500 tracking-wider">TOTAL</div>
            <div className="text-lg font-black text-gray-300">
              {teamStats.totalSessions}
            </div>
          </div>
        </div>
      )}

      {/* Submit score */}
      {currentResult && (
        <button
          onClick={handleSubmitScore}
          disabled={submitting}
          className="py-2.5 rounded-xl text-xs font-bold tracking-wider bg-gradient-to-r from-neon-orange to-neon-pink text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
        >
          {submitting ? '送信中...' : `スコア ${currentResult.overallScore} を提出`}
        </button>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-dark-500 tracking-wider">SORT:</span>
        {(['latest', 'best', 'name'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider transition-all ${
              sortBy === s
                ? 'bg-neon-orange/20 text-neon-orange'
                : 'text-dark-500 hover:text-gray-400'
            }`}
          >
            {s === 'latest' ? 'Latest' : s === 'best' ? 'Best' : 'Name'}
          </button>
        ))}
      </div>

      {/* Members list */}
      <div className="flex flex-col gap-3">
        {sortedMembers.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            scores={scores}
            isInstructor={isInstructor}
          />
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center text-dark-500 text-xs py-8">
          メンバーがまだいません
        </div>
      )}
    </div>
  );
}

// ── Main TeamView ──
export default function TeamView({ onClose, currentResult }: TeamViewProps) {
  const [tab, setTab] = useState<'list' | 'create' | 'join'>('list');
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getMyTeams();
      setTeams(t);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirebaseConfigured()) loadTeams();
    else setLoading(false);
  }, [loadTeams]);

  if (!isFirebaseConfigured()) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-xs font-bold tracking-[0.15em] text-neon-orange mb-1">TEAM / SCHOOL</div>
        <SetupGuide />
      </div>
    );
  }

  if (selectedTeam) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-xs font-bold tracking-[0.15em] text-neon-orange mb-1">TEAM / SCHOOL</div>
        <TeamDetail
          team={selectedTeam}
          currentResult={currentResult}
          onBack={() => setSelectedTeam(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold tracking-[0.15em] text-neon-orange">TEAM / SCHOOL</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: 'list', label: 'My Teams' },
          { id: 'create', label: 'Create' },
          { id: 'join', label: 'Join' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-all ${
              tab === t.id
                ? 'bg-neon-orange/20 text-neon-orange border border-neon-orange/50'
                : 'bg-dark-800 text-dark-500 border border-dark-600 hover:border-dark-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'list' && (
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-dark-600 border-t-neon-orange animate-spin" />
            </div>
          ) : teams.length > 0 ? (
            teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t)}
                className="bg-dark-800 rounded-xl border border-dark-600 p-4 text-left hover:border-neon-orange/50 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-sm">{t.name}</h4>
                  <span className="text-[10px] text-dark-500">
                    {t.memberCount} members
                  </span>
                </div>
                {t.description && (
                  <p className="text-[10px] text-dark-500 mb-1">{t.description}</p>
                )}
                <div className="text-[10px] text-dark-500">
                  Instructor: {t.instructorName}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">👥</div>
              <p className="text-xs text-dark-500 mb-1">参加しているチームがありません</p>
              <p className="text-[10px] text-dark-500">
                チームを作成するか、コードで参加しましょう
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'create' && (
        <CreateTeamForm onCreated={() => { setTab('list'); loadTeams(); }} />
      )}

      {tab === 'join' && (
        <JoinTeamForm onJoined={() => { setTab('list'); loadTeams(); }} />
      )}
    </div>
  );
}
