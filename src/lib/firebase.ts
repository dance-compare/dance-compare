import type { FirebaseApp } from 'firebase/app';
import type { Firestore, Timestamp } from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';

// ─── Firebase config ───
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}

// ─── Lazy initialization (avoids crash when config is empty) ───
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

async function getFirebaseApp(): Promise<FirebaseApp> {
  if (_app) return _app;
  const { initializeApp } = await import('firebase/app');
  _app = initializeApp(firebaseConfig);
  return _app;
}

async function getDb(): Promise<Firestore> {
  if (_db) return _db;
  const app = await getFirebaseApp();
  const { getFirestore } = await import('firebase/firestore');
  _db = getFirestore(app);
  return _db;
}

async function getAuthInstance(): Promise<Auth> {
  if (_auth) return _auth;
  const app = await getFirebaseApp();
  const { getAuth } = await import('firebase/auth');
  _auth = getAuth(app);
  return _auth;
}

// ─── Auth ───
export async function ensureAuth(): Promise<User | null> {
  if (!isFirebaseConfigured()) return null;
  const auth = await getAuthInstance();
  const { signInAnonymously, onAuthStateChanged } = await import('firebase/auth');
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then((cred) => resolve(cred.user))
          .catch(() => resolve(null));
      }
    });
  });
}

// ─── Types ───
export interface Challenge {
  id: string;
  title: string;
  description: string;
  songName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: Date;
  endsAt: Date | null;
  participantCount: number;
  creatorName: string;
}

export interface ChallengeSubmission {
  id: string;
  challengeId: string;
  userId: string;
  userName: string;
  overallScore: number;
  bodyPartScores: { name: string; nameJa: string; score: number }[];
  submittedAt: Date;
  memo: string;
}

// ─── Challenges ───
export async function getChallenges(): Promise<Challenge[]> {
  if (!isFirebaseConfigured()) return [];
  const db = await getDb();
  const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
  const q = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      description: data.description,
      songName: data.songName,
      difficulty: data.difficulty,
      createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      endsAt: data.endsAt ? (data.endsAt as Timestamp).toDate() : null,
      participantCount: data.participantCount || 0,
      creatorName: data.creatorName || 'Anonymous',
    };
  });
}

export async function createChallenge(data: {
  title: string;
  description: string;
  songName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  creatorName: string;
  durationDays: number;
}): Promise<string> {
  const db = await getDb();
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + data.durationDays);
  const ref = await addDoc(collection(db, 'challenges'), {
    title: data.title,
    description: data.description,
    songName: data.songName,
    difficulty: data.difficulty,
    creatorName: data.creatorName,
    createdAt: serverTimestamp(),
    endsAt,
    participantCount: 0,
  });
  return ref.id;
}

// ─── Teams (school / group management) ───
export interface Team {
  id: string;
  name: string;
  description: string;
  instructorId: string;
  instructorName: string;
  joinCode: string;
  createdAt: Date;
  memberCount: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  role: 'instructor' | 'student';
  joinedAt: Date;
}

export interface TeamScore {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  overallScore: number;
  bodyPartScores: { name: string; nameJa: string; score: number }[];
  submittedAt: Date;
  memo: string;
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createTeam(data: {
  name: string;
  description: string;
  instructorName: string;
}): Promise<string> {
  const user = await ensureAuth();
  if (!user) throw new Error('認証に失敗しました');

  const db = await getDb();
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const joinCode = generateJoinCode();

  const ref = await addDoc(collection(db, 'teams'), {
    name: data.name,
    description: data.description,
    instructorId: user.uid,
    instructorName: data.instructorName,
    joinCode,
    createdAt: serverTimestamp(),
    memberCount: 1,
  });

  // Add instructor as first member
  await addDoc(collection(db, 'teamMembers'), {
    teamId: ref.id,
    userId: user.uid,
    userName: data.instructorName,
    role: 'instructor',
    joinedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getMyTeams(): Promise<Team[]> {
  if (!isFirebaseConfigured()) return [];
  const user = await ensureAuth();
  if (!user) return [];

  const db = await getDb();
  const { collection, query, where, getDocs } = await import('firebase/firestore');

  // Get teams where user is a member
  const memberQ = query(collection(db, 'teamMembers'), where('userId', '==', user.uid));
  const memberSnap = await getDocs(memberQ);
  const teamIds = memberSnap.docs.map((d) => d.data().teamId as string);

  if (teamIds.length === 0) return [];

  // Fetch each team
  const { doc, getDoc } = await import('firebase/firestore');
  const teams: Team[] = [];
  for (const tid of teamIds) {
    const teamSnap = await getDoc(doc(db, 'teams', tid));
    if (teamSnap.exists()) {
      const data = teamSnap.data();
      teams.push({
        id: teamSnap.id,
        name: data.name,
        description: data.description,
        instructorId: data.instructorId,
        instructorName: data.instructorName,
        joinCode: data.joinCode,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        memberCount: data.memberCount || 0,
      });
    }
  }
  return teams;
}

export async function joinTeam(joinCode: string, userName: string): Promise<string> {
  const user = await ensureAuth();
  if (!user) throw new Error('認証に失敗しました');

  const db = await getDb();
  const { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

  // Find team by join code
  const q = query(collection(db, 'teams'), where('joinCode', '==', joinCode.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('チームが見つかりません。コードを確認してください。');

  const teamDoc = snap.docs[0];
  const teamId = teamDoc.id;

  // Check if already a member
  const memberQ = query(
    collection(db, 'teamMembers'),
    where('teamId', '==', teamId),
    where('userId', '==', user.uid)
  );
  const memberSnap = await getDocs(memberQ);
  if (!memberSnap.empty) throw new Error('既にこのチームに参加しています。');

  // Add as student
  await addDoc(collection(db, 'teamMembers'), {
    teamId,
    userId: user.uid,
    userName,
    role: 'student',
    joinedAt: serverTimestamp(),
  });

  // Increment member count
  await updateDoc(doc(db, 'teams', teamId), {
    memberCount: (teamDoc.data().memberCount || 0) + 1,
  });

  return teamId;
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  if (!isFirebaseConfigured()) return [];
  const db = await getDb();
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
  const q = query(
    collection(db, 'teamMembers'),
    where('teamId', '==', teamId),
    orderBy('joinedAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      teamId: data.teamId,
      userId: data.userId,
      userName: data.userName,
      role: data.role,
      joinedAt: (data.joinedAt as Timestamp)?.toDate() || new Date(),
    };
  });
}

export async function submitTeamScore(data: {
  teamId: string;
  userName: string;
  overallScore: number;
  bodyPartScores: { name: string; nameJa: string; score: number }[];
  memo: string;
}): Promise<string> {
  const user = await ensureAuth();
  if (!user) throw new Error('認証に失敗しました');

  const db = await getDb();
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

  const ref = await addDoc(collection(db, 'teamScores'), {
    teamId: data.teamId,
    userId: user.uid,
    userName: data.userName,
    overallScore: data.overallScore,
    bodyPartScores: data.bodyPartScores,
    submittedAt: serverTimestamp(),
    memo: data.memo,
  });
  return ref.id;
}

export async function getTeamScores(teamId: string): Promise<TeamScore[]> {
  if (!isFirebaseConfigured()) return [];
  const db = await getDb();
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
  const q = query(
    collection(db, 'teamScores'),
    where('teamId', '==', teamId),
    orderBy('submittedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      teamId: data.teamId,
      userId: data.userId,
      userName: data.userName,
      overallScore: data.overallScore,
      bodyPartScores: data.bodyPartScores || [],
      submittedAt: (data.submittedAt as Timestamp)?.toDate() || new Date(),
      memo: data.memo || '',
    };
  });
}

// ─── Submissions (leaderboard) ───
export async function getLeaderboard(challengeId: string): Promise<ChallengeSubmission[]> {
  if (!isFirebaseConfigured()) return [];
  const db = await getDb();
  const { collection, query, orderBy, limit, where, getDocs } = await import('firebase/firestore');
  const q = query(
    collection(db, 'submissions'),
    where('challengeId', '==', challengeId),
    orderBy('overallScore', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      challengeId: data.challengeId,
      userId: data.userId,
      userName: data.userName,
      overallScore: data.overallScore,
      bodyPartScores: data.bodyPartScores || [],
      submittedAt: (data.submittedAt as Timestamp)?.toDate() || new Date(),
      memo: data.memo || '',
    };
  });
}

export async function submitScore(data: {
  challengeId: string;
  userName: string;
  overallScore: number;
  bodyPartScores: { name: string; nameJa: string; score: number }[];
  memo: string;
}): Promise<string> {
  const user = await ensureAuth();
  if (!user) throw new Error('認証に失敗しました');

  const db = await getDb();
  const { collection, doc, addDoc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');

  const ref = await addDoc(collection(db, 'submissions'), {
    challengeId: data.challengeId,
    userId: user.uid,
    userName: data.userName,
    overallScore: data.overallScore,
    bodyPartScores: data.bodyPartScores,
    submittedAt: serverTimestamp(),
    memo: data.memo,
  });

  // Increment participant count
  const challengeRef = doc(db, 'challenges', data.challengeId);
  const challengeSnap = await getDoc(challengeRef);
  if (challengeSnap.exists()) {
    await updateDoc(challengeRef, {
      participantCount: (challengeSnap.data().participantCount || 0) + 1,
    });
  }

  return ref.id;
}
