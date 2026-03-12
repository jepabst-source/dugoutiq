import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, appleProvider } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch or create user document
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setUserDoc(snap.data());
          // Restore last active team
          const saved = localStorage.getItem('dugoutiq_activeTeam');
          if (saved && snap.data().teamIds?.includes(saved)) {
            setActiveTeamId(saved);
          } else if (snap.data().teamIds?.length > 0) {
            setActiveTeamId(snap.data().teamIds[0]);
          }
        } else {
          // First-time user
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
        }
      } else {
        setUser(null);
        setUserDoc(null);
        setActiveTeamId(null);
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

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const loginWithApple = () => signInWithPopup(auth, appleProvider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user,
      userDoc,
      loading,
      activeTeamId,
      setActiveTeamId,
      loginWithGoogle,
      loginWithApple,
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
