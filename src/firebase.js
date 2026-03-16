// ─────────────────────────────────────────────────────────────────────────────
// Firebase 설정
// Firebase 콘솔(https://console.firebase.google.com)에서 프로젝트 생성 후
// 아래 값을 본인의 Firebase 프로젝트 설정으로 교체하세요.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBtThKhtbsN2KMjEMnhYden7BMgLUrwHDM",
  authDomain: "my-test-2603.firebaseapp.com",
  projectId: "my-test-2603",
  storageBucket: "my-test-2603.firebasestorage.app",
  messagingSenderId: "103812365175",
  appId: "1:103812365175:web:02bb6c01ef19d83bd27f72"
};

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
