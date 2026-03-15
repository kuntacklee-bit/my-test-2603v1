// 감사 코인 Service Worker
const CACHE_NAME = 'gratitude-coins-v1'

// 오프라인에서도 열 수 있도록 캐시할 파일들
const STATIC_ASSETS = [
  '/',
  '/index.html',
]

// 설치: 정적 파일 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// 활성화: 오래된 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 네트워크 요청 처리: Network First (Firebase 실시간 데이터 우선)
self.addEventListener('fetch', event => {
  // Firebase / API 요청은 항상 네트워크 사용
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis.com')
  ) {
    return // 기본 fetch 동작 유지
  }

  // 그 외: 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      }).catch(() => caches.match('/index.html')) // 오프라인 fallback
    })
  )
})
