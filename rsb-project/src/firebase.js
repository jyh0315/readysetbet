import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAvXIpD_jZWzmaSucx1tlFOvt2Hw1fdO0M",
  authDomain: "dobak-1616d.firebaseapp.com",
  databaseURL: "https://dobak-1616d-default-rtdb.firebaseio.com",
  projectId: "dobak-1616d",
  storageBucket: "dobak-1616d.firebasestorage.app",
  messagingSenderId: "148241455594",
  appId: "1:148241455594:web:6b29bb2b80ca79c3e0ba93",
  measurementId: "G-H69BMTSF02",
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getDatabase(app);
export const auth = getAuth(app);

/** 익명 로그인 보장. uid를 resolve합니다. */
export function ensureAnonAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) resolve(user.uid);
      else signInAnonymously(auth).catch(reject);
    });
  });
}
