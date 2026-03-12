import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

// TODO: Replace with your new Firebase project config
// Go to console.firebase.google.com → Create project "dugoutiq"
// Enable Authentication (Google + Apple providers)
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
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

export default app;
