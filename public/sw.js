// منصة رافد | Service Worker — وضع عدم الاتصال + إشعارات الدفع
const CACHE = 'rafid-v1'
const ASSETS = ['/', '/index.html', '/manifest.json', '/logo.png', '/icon-192.png']

// التثبيت: تخزين الأصول الأساسية
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}))
  self.skipWaiting()
})

// التفعيل: تنظيف الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})

// الجلب: شبكة أولاً، ثم الكاش عند عدم الاتصال (للصفحات والأصول)
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  // لا نتدخّل في طلبات Supabase (API) — نتركها للشبكة
  if (req.url.includes('supabase.co')) return
  e.respondWith(
    fetch(req).then(res => {
      // نخزّن نسخة من الاستجابة الناجحة
      const copy = res.clone()
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
      return res
    }).catch(() => caches.match(req).then(r => r || caches.match('/')))
  )
})

// استقبال إشعار دفع
self.addEventListener('push', (e) => {
  let data = { title: 'منصة رافد', body: 'لديك تحديث جديد' }
  try { if (e.data) data = e.data.json() } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'منصة رافد', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: data.url || '/',
    })
  )
})

// النقر على الإشعار يفتح المنصة
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data || '/'))
})
