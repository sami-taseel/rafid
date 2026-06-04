import { useState, useEffect } from 'react'
export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    // لا نستخدم localStorage (غير مدعوم)، نعتمد تفضيل النظام مبدئياً
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])
  return [dark, setDark]
}
