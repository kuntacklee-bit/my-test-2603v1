// ─────────────────────────────────────────────────────────────────────────────
// Firebase 설정
// Firebase 콘솔(https://console.firebase.google.com)에서 프로젝트 생성 후
// 아래 값을 본인의 Firebase 프로젝트 설정으로 교체하세요.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            "여기에-API-KEY-입력",
  authDomain:        "여기에-AUTH-DOMAIN-입력",
  projectId:         "여기에-PROJECT-ID-입력",
  storageBucket:     "여기에-STORAGE-BUCKET-입력",
  messagingSenderId: "여기에-MESSAGING-SENDER-ID-입력",
  appId:             "여기에-APP-ID-입력",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
