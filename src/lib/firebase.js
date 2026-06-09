import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  GoogleAuthProvider, OAuthProvider,
} from 'firebase/auth';

// TODO: Replace with your new Firebase project config
// Go to console.firebase.google.com → Create project "dugoutiq"
// Enable Authentication (Google provider)
// Enable Cloud Firestore
const firebaseConfig = {
  apiKey: "AIzaSyA1kQSYzx7SpqodCYBX54tbpcXEz-Ld_Nk",
  authDomain: "dugoutiq-ade15.firebaseapp.com",
  projectId: "dugoutiq-ade15",
  storageBucket: "dugoutiq-ade15.firebasestorage.app",
  messagingSenderId: "670201192937",
  appId: "1:670201192937:web:20c76693d57355ebcd6b78",
  measurementId: "G-Z2VVXQ6N4R"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Auth init differs by platform.
//
// On the web we use getAuth(), which wires up the popup/redirect resolver —
// required for the Google/Apple sign-in popups.
//
// Inside the native iOS/Android WebView (capacitor://localhost) that default
// resolver tries to load the cross-origin auth helper iframe from authDomain
// (dugoutiq-ade15.firebaseapp.com) at startup. In an iOS WKWebView that iframe
// load can hang forever, so onAuthStateChanged never fires its first event and
// the app sits on the launch loader indefinitely (Apple 2.1 rejection, build 8).
//
// On native we don't need that resolver: Apple sign-in goes through the
// Capacitor plugin + signInWithCredential, and email/password is a plain REST
// call. So we use initializeAuth with explicit local persistence and no
// resolver — auth resolves from disk immediately, no iframe.
const isNativeShell = typeof window !== 'undefined'
  && window.Capacitor
  && window.Capacitor.isNativePlatform
  && window.Capacitor.isNativePlatform();

export const auth = isNativeShell
  ? initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  : getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export default app;
