// ضغط الصور في المتصفح قبل الرفع — يحل مشاكل الحجم الكبير و HEIC
// يحوّل أي صورة (بما فيها HEIC عبر رسمها على canvas) إلى JPEG مضغوط

export async function compressImage(file, { maxDim = 1600, quality = 0.8, maxSizeMB = 2 } = {}) {
  // ليست صورة (PDF مثلاً) → نعيدها كما هي
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    return file
  }
  // صورة صغيرة أصلاً → لا داعي للضغط
  if (file.size <= maxSizeMB * 1024 * 1024 && !/heic|heif/i.test(file.type + file.name)) {
    return file
  }

  try {
    const bitmap = await loadBitmap(file)
    let { width, height } = bitmap
    // تصغير الأبعاد مع الحفاظ على النسبة
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height)
      width = Math.round(width * scale); height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)
    if (bitmap.close) bitmap.close()

    // نجرّب جودات متدرّجة حتى نصل لحجم مناسب
    let q = quality
    let blob = await canvasToBlob(canvas, q)
    while (blob && blob.size > maxSizeMB * 1024 * 1024 && q > 0.4) {
      q -= 0.15
      blob = await canvasToBlob(canvas, q)
    }
    if (!blob) return file
    // اسم جديد بامتداد jpg
    const base = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], base + '.jpg', { type: 'image/jpeg' })
  } catch (e) {
    console.warn('تعذّر ضغط الصورة، سنرفع الأصل:', e)
    return file   // فشل الضغط → نرفع الأصل (أفضل من منع الطالب)
  }
}

function loadBitmap(file) {
  // createImageBitmap يدعم أغلب الصيغ ويعمل بكفاءة
  if (window.createImageBitmap) {
    return createImageBitmap(file).catch(() => loadViaImg(file))
  }
  return loadViaImg(file)
}

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّر قراءة الصورة')) }
    img.src = url
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => {
    if (canvas.toBlob) canvas.toBlob(b => resolve(b), 'image/jpeg', quality)
    else resolve(null)
  })
}
