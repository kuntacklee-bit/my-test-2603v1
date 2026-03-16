// ─────────────────────────────────────────────────────────────────────────────
// Firebase 설정
// Firebase 콘솔(https://console.firebase.google.com)에서 프로젝트 생성 후
// 아래 값을 본인의 Firebase 프로젝트 설정으로 교체하세요.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyC1IcatLvy9k80vjIChcbPs-Iz6RNkygbk",
  authDomain: "my-test-2603v1.firebaseapp.com",
  projectId: "my-test-2603v1",
  storageBucket: "my-test-2603v1.firebasestorage.app",
  messagingSenderId: "194939487080",
  appId: "1:194939487080:web:1ece95639034a0e4ce0cdd"
};

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
