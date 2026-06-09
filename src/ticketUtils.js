import { supabase } from './supabaseClient'

// تنظيف اسم الملف: التخزين يقبل ASCII فقط، فنزيل العربية والرموز
export function safeName(name) {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
  let base = (dot >= 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9]+/g, '_')   // أي رمز غير لاتيني/رقم → شرطة (يزيل العربية والمسافات)
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 32)
  if (!base) base = 'file'            // إن كان الاسم عربياً بالكامل، نستخدم اسماً عاماً
  return base + (ext || '')
}

// التحقق أن الملف صورة
export function isImageFile(file) {
  return file && /^image\//.test(file.type)
}

// رفع ملف باسم آمن، يعيد المسار. يرمي خطأً واضحاً عند الفشل
export async function uploadTicketFile(ticketId, file) {
  // حد الحجم: 10 ميجابايت
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم الملف كبير (الحد ١٠ ميجابايت)')
  const path = `tickets/${ticketId}/${Date.now()}_${safeName(file.name)}`
  const { error } = await supabase.storage.from('student-docs').upload(path, file, {
    contentType: file.type || 'application/octet-stream', upsert: false,
  })
  if (error) throw new Error(error.message || 'تعذّر رفع الملف')
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
