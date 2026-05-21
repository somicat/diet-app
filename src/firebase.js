import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// 앞으로 사용할 데이터베이스(Firestore)와 인증(Auth) 모듈도 미리 가져옵니다.
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Vite 환경변수(import.meta.env)를 사용하여 설정값을 불러옵니다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// App.jsx 등 다른 파일에서 사용할 수 있도록 DB와 Auth를 내보냅니다.
export const db = getFirestore(app);
export const auth = getAuth(app);