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

// عرض المدة بالساعات بصيغة عربية طبيعية
// 30→«نصف ساعة» · 60→«ساعة» · 90→«ساعة ونصف» · 120→«ساعتان» · 360→«٦ ساعات»
export function formatDuration(min) {
  const m = Number(min)
  if (!m || m <= 0) return ''
  if (m === 30) return 'نصف ساعة'
  if (m < 60) return `${m} دقيقة`

  const hours = Math.floor(m / 60)
  const rem = m % 60

  // اسم الساعات
  let hStr
  if (hours === 1) hStr = 'ساعة'
  else if (hours === 2) hStr = 'ساعتان'
  else if (hours <= 10) hStr = `${hours} ساعات`
  else hStr = `${hours} ساعة`

  if (rem === 0) return hStr
  if (rem === 30) return hours === 1 ? 'ساعة ونصف' : `${hStr} ونصف`
  if (rem === 15) return hours === 1 ? 'ساعة وربع' : `${hStr} وربع`
  if (rem === 45) return hours === 1 ? 'ساعة وثلاثة أرباع' : `${hStr} و٤٥ دقيقة`
  return `${hStr} و${rem} دقيقة`
}
