import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signOut, signInWithCredential,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile,
  OAuthProvider, GoogleAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, appleProvider } from '../lib/firebase';
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
    // Safety net: if auth never resolves (e.g. a WebView quirk stalls Firebase
    // init), don't trap the user on the launch loader forever. After 8s, fall
    // through to the login page instead of an infinite spinner. onAuthStateChanged
    // setting loading=false first is the normal path; this only fires if it never does.
    const failsafe = setTimeout(() => setLoading(false), 8000);
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(failsafe);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();

          // Demo account auto-reset: recreate a fresh team on every login.
          //
          // Seed FIRST, delete the old teams only once the seed succeeds. The
          // reverse order left the account permanently empty whenever the seed
          // failed partway (flaky connection), and an App Review tester who
          // reopened the app would land on a blank roster with no way back.
          if (firebaseUser.email === DEMO_ACCOUNT_EMAIL && !demoResetDone.current) {
            demoResetDone.current = true;
            setCreatingDemo(true);
            const existingTeamIds = data.teamIds || [];
            let demoId = null;
            for (let attempt = 0; attempt < 2 && !demoId; attempt++) {
              try {
                demoId = await createDemoTeam(firebaseUser.uid);
              } catch (err) {
                console.error(`Demo seed attempt ${attempt + 1} failed:`, err);
              }
            }

            if (demoId) {
              // Safe to clear the previous teams now that the new one exists.
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
              await updateDoc(userRef, { teamIds: [demoId] });
              setActiveTeamId(demoId);
              const updatedSnap = await getDoc(userRef);
              if (updatedSnap.exists()) setUserDoc(updatedSnap.data());
              setAllTeams([{ id: demoId, name: 'Demo Dolphins', sport: 'softball', seasonLabel: 'Spring', seasonYear: new Date().getFullYear() }]);
              setCreatingDemo(false);
              setUser(firebaseUser);
              setLoading(false);
              return; // skip normal team loading
            }

            // Seed failed twice — leave the existing teams alone and fall
            // through to normal loading so the reviewer still sees a populated
            // app rather than an empty one.
            setCreatingDemo(false);
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
    return () => { clearTimeout(failsafe); unsub(); };
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

  const loginWithGoogle = async () => {
    // On native (iOS + Android) use the Firebase Authentication plugin — the
    // system Google account picker (Credential Manager on Android, the Google
    // Sign-In SDK on iOS) — and bridge its idToken to the JS SDK with
    // signInWithCredential, mirroring loginWithApple.
    //
    // Why not the popup on native: signInWithPopup degrades to a redirect inside
    // the WebView, which partitions/clears the sessionStorage the redirect relies
    // on, so it fails intermittently with "missing initial state". The native
    // picker has no such round-trip. skipNativeAuth:true (capacitor.config) keeps
    // the JS SDK as the single source of truth, so onAuthStateChanged still
    // drives the app. iOS also needs the REVERSED_CLIENT_ID URL scheme in
    // Info.plist for the Google callback (added).
    if (isNative()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error('Google Sign In failed: no identity token');
      const credential = GoogleAuthProvider.credential(idToken);
      return signInWithCredential(auth, credential);
    }
    return signInWithPopup(auth, googleProvider);
  };

  const loginWithApple = async () => {
    // On native use the Firebase Authentication plugin — the documented
    // cross-platform path. iOS presents the system Sign in with Apple sheet;
    // the plugin returns an idToken + rawNonce that we bridge to the JS SDK via
    // signInWithCredential. skipNativeAuth keeps the JS SDK authoritative, so
    // onAuthStateChanged still drives the app. (This replaces the old
    // @capacitor-community/apple-sign-in path, whose Service-ID/redirect config
    // was web-oriented and failed on the native sheet — and it needs the
    // com.apple.developer.applesignin entitlement, now added.)
    if (isNative()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error('Apple Sign In failed: no identity token');
      const provider = new OAuthProvider('apple.com');
      // rawNonce is required — Firebase verifies its SHA-256 hash against the token.
      const credential = provider.credential({ idToken, rawNonce: result.credential?.nonce });
      const cred = await signInWithCredential(auth, credential);
      // Apple returns the name only on first sign-in — capture it then.
      const displayName = result.user?.displayName;
      if (displayName && !cred.user.displayName) {
        try { await updateProfile(cred.user, { displayName }); } catch {}
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
