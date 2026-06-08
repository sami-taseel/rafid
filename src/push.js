import { supabase } from './supabaseClient'

// ملاحظة: مفتاح VAPID العام يُوضع هنا بعد توليده (إعداد لمرة واحدة)
// حتى توليده، تبقى الدالة جاهزة ولا تُفعّل الاشتراك
const VAPID_PUBLIC_KEY = '' // ضع مفتاح VAPID العام هنا

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// تسجيل Service Worker (للكاش وعدم الاتصال — يعمل دائماً)
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.register('/sw.js') } catch { return null }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// طلب الإذن والاشتراك في إشعارات الدفع
export async function subscribePush() {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return { ok: false, reason: 'unsupported' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'denied' }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  const { data: au } = await supabase.auth.getUser()
  if (!au?.user) return { ok: false, reason: 'no-user' }
  const json = sub.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: au.user.id, endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh, auth: json.keys?.auth,
  }, { onConflict: 'endpoint' })
  return { ok: true }
}

export async function pushStatus() {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission // granted | denied | default
}
