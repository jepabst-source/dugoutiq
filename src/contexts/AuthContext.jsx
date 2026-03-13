import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [allTeams, setAllTeams] = useState([]); // [{id, name, sport, seasonLabel, seasonYear}]

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserDoc(data);

          // Load basic info for all teams
          const teamIds = data.teamIds || [];
          const teams = [];
          for (const tid of teamIds) {
            try {
              const tSnap = await getDoc(doc(db, 'teams', tid));
              if (tSnap.exists()) {
                const t = tSnap.data();
                teams.push({ id: tid, name: t.name, sport: t.sport, seasonLabel: t.seasonLabel, seasonYear: t.seasonYear });
              }
            } catch {}
          }
          setAllTeams(teams);

          // Restore last active team
          const saved = localStorage.getItem('dugoutiq_activeTeam');
          if (saved && teamIds.includes(saved)) {
            setActiveTeamId(saved);
          } else if (teamIds.length > 0) {
            setActiveTeamId(teamIds[0]);
          }
        } else {
          const newUser = {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            plan: 'free',
            teamIds: [],
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, newUser);
          setUserDoc(newUser);
          setAllTeams([]);
        }
      } else {
        setUser(null);
        setUserDoc(null);
        setActiveTeamId(null);
        setAllTeams([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Persist active team selection
  useEffect(() => {
    if (activeTeamId) {
      localStorage.setItem('dugoutiq_activeTeam', activeTeamId);
    }
  }, [activeTeamId]);

  // Refresh allTeams when userDoc.teamIds changes
  const refreshTeams = async () => {
    if (!userDoc?.teamIds) return;
    const teams = [];
    for (const tid of userDoc.teamIds) {
      try {
        const tSnap = await getDoc(doc(db, 'teams', tid));
        if (tSnap.exists()) {
          const t = tSnap.data();
          teams.push({ id: tid, name: t.name, sport: t.sport, seasonLabel: t.seasonLabel, seasonYear: t.seasonYear });
        }
      } catch {}
    }
    setAllTeams(teams);
  };

  const refreshUserDoc = async () => {
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      setUserDoc(snap.data());
    }
  };

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

  const signUpWithEmail = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    await sendEmailVerification(cred.user);
    return cred;
  };

  const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const resendVerification = () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      return sendEmailVerification(auth.currentUser);
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user,
      userDoc,
      loading,
      activeTeamId,
      setActiveTeamId,
      allTeams,
      refreshTeams,
      refreshUserDoc,
      loginWithGoogle,
      signUpWithEmail,
      loginWithEmail,
      resetPassword,
      resendVerification,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
