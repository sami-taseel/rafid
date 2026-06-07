import { supabase } from './supabaseClient'

// تنظيف اسم الملف: إزالة المسافات والرموز الخاصة التي تكسر مسار التخزين
export function safeName(name) {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .replace(/[^\w\u0600-\u06FF]+/g, '_')   // أي رمز غير حرف/رقم → شرطة سفلية
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 40) || 'file'
  return base + ext
}

// رفع مرفق بلاغ باسم آمن، يعيد المسار
export async function uploadTicketFile(ticketId, file) {
  const path = `tickets/${ticketId}/${Date.now()}_${safeName(file.name)}`
  const { error } = await supabase.storage.from('student-docs').upload(path, file)
  if (error) throw error
  return path
}

// جلب رابط موقّع لعرض المرفق
export async function signedUrl(path) {
  const { data, error } = await supabase.storage.from('student-docs').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export function isImage(path) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(path || '')
}
