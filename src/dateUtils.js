// تنسيق الوقت إلى صباحي/مسائي بالعربية (بدل نظام 24 ساعة)
export function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const period = h < 12 ? 'صباحاً' : 'مساءً'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  const mm = String(m).padStart(2, '0')
  return `${h12}:${mm} ${period}`
}

// تنسيق التاريخ بالعربية (يُعرض RTL طبيعياً)
export function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return d }
}
