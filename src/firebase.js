
// ─────────────────────────────────────────────────────────────────────────────
// Firebase 설정
// Firebase 콘솔(https://console.firebase.google.com)에서 프로젝트 생성 후
// 아래 값을 본인의 Firebase 프로젝트 설정으로 교체하세요.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 임시로 추가 — 확인 후 삭제
console.log('🔥 PROJECT_ID:', process.env.REACT_APP_FIREBASE_PROJECT_ID);
console.log('🔥 API_KEY:', process.env.REACT_APP_FIREBASE_API_KEY);


const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);