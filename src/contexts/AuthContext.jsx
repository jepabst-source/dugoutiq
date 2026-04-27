import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signOut, signInWithCredential,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile,
  OAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, appleProvider } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { initPushNotifications, cleanupPushNotifications } from '../services/notifications';
import { initPurchases } from '../services/payments';
import { enableBiometricLogin, disableBiometricLogin } from '../services/biometric';
import { isNative } from '../services/platform';
import { createDemoTeam } from '../utils/demoTeam';

const AuthContext = createContext(null);
const DEMO_ACCOUNT_EMAIL = 'test@lineupman.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const demoResetDone = useRef(false);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [allTeams, setAllTeams] = useState([]); // [{id, name, sport, seasonLabel, seasonYear}]

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();

          // Demo account auto-reset: wipe and recreate fresh every login
          if (firebaseUser.email === DEMO_ACCOUNT_EMAIL && !demoResetDone.current) {
            demoResetDone.current = true;
            setCreatingDemo(true);
            // Delete all existing teams
            const existingTeamIds = data.teamIds || [];
            for (const tid of existingTeamIds) {
              try {
                const playerSnap = await getDocs(collection(db, 'teams', tid, 'players'));
                await Promise.all(playerSnap.docs.map(d => deleteDoc(d.ref)));
                const abSnap = await getDocs(collection(db, 'teams', tid, 'atBats'));
                await Promise.all(abSnap.docs.map(d => deleteDoc(d.ref)));
                const gameSnap = await getDocs(collection(db, 'teams', tid, 'games'));
                await Promise.all(gameSnap.docs.map(d => deleteDoc(d.ref)));
                await deleteDoc(doc(db, 'teams', tid));
              } catch {}
            }
            // Reset user doc
            await setDoc(userRef, { ...data, teamIds: [] });
            // Create fresh Demo Dolphins
            try {
              const demoId = await createDemoTeam(firebaseUser.uid);
              setActiveTeamId(demoId);
              const updatedSnap = await getDoc(userRef);
              if (updatedSnap.exists()) setUserDoc(updatedSnap.data());
              setAllTeams([{ id: demoId, name: 'Demo Dolphins', sport: 'softball', seasonLabel: 'Spring', seasonYear: new Date().getFullYear() }]);
            } catch (err) {
              console.error('Demo reset error:', err);
            }
            setCreatingDemo(false);
            setUser(firebaseUser);
            setLoading(false);
            return; // skip normal team loading
          }

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
          // Create Demo Dolphins team for the new user
          try {
            setCreatingDemo(true);
            const demoId = await createDemoTeam(firebaseUser.uid);
            setActiveTeamId(demoId);
            const updatedSnap = await getDoc(userRef);
            if (updatedSnap.exists()) setUserDoc(updatedSnap.data());
            setAllTeams([{ id: demoId, name: 'Demo Dolphins', sport: 'softball', seasonLabel: 'Spring', seasonYear: new Date().getFullYear() }]);
          } catch (err) {
            console.error('Demo team creation error:', err);
          }
          setCreatingDemo(false);
          // Google Ads conversion tracking
          if (typeof gtag === 'function') {
            gtag('event', 'conversion', {
              'send_to': 'AW-1032290089/4FCZCMPNuQUQqf6d7AM',
              'value': 1.0,
              'currency': 'USD'
            });
          }
        }
        setUser(firebaseUser);
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

  // Register push notifications and RevenueCat after login
  useEffect(() => {
    if (!user) return;
    initPushNotifications({
      onToken: async (token) => {
        // Save the FCM token to the user's Firestore doc for server-side sends
        try {
          await updateDoc(doc(db, 'users', user.uid), { fcmToken: token });
        } catch {}
      },
    });
    // Init Google Play Billing on native (no-op on web)
    initPurchases();
    // Enable biometric login for next app launch on native
    if (isNative()) enableBiometricLogin();
    return () => { cleanupPushNotifications(); };
  }, [user]);

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

  const loginWithApple = async () => {
    // On native iOS use the Capacitor plugin (system Sign In with Apple sheet)
    // and bridge the identityToken to Firebase. On web/Android, use Firebase popup.
    if (Capacitor.getPlatform() === 'ios') {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
      // clientId must match the Service ID configured in Apple Developer + Firebase
      const result = await SignInWithApple.authorize({
        clientId: 'com.studiopabst.dugoutiq.signin',
        redirectURI: 'https://dugoutiq-ade15.firebaseapp.com/__/auth/handler',
        scopes: 'email name',
        nonce: Math.random().toString(36).slice(2),
      });
      const { identityToken, givenName, familyName } = result.response || {};
      if (!identityToken) throw new Error('Apple Sign In failed: no identity token');
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken });
      const cred = await signInWithCredential(auth, credential);
      // Apple returns name only on first sign-in — capture it then.
      const fullName = [givenName, familyName].filter(Boolean).join(' ').trim();
      if (fullName && !cred.user.displayName) {
        try { await updateProfile(cred.user, { displayName: fullName }); } catch {}
      }
      return cred;
    }
    return signInWithPopup(auth, appleProvider);
  };

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

  const logout = async () => {
    disableBiometricLogin();
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userDoc,
      loading,
      creatingDemo,
      activeTeamId,
      setActiveTeamId,
      allTeams,
      refreshTeams,
      refreshUserDoc,
      loginWithGoogle,
      loginWithApple,
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
