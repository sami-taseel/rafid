import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { translations } from './translations'

const LangCtx = createContext(null)
export function useLang() { return useContext(LangCtx) }

export function LangProvider({ children }) {
  const [lang, setLang] = useState('ar')
  const [available, setAvailable] = useState([{ code: 'ar', name_native: 'العربية', is_rtl: true }])

  useEffect(() => {
    supabase.from('app_languages').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data && data.length) setAvailable(data) })
  }, [])

  const t = (key) => (translations[lang] && translations[lang][key]) || translations.ar[key] || key
  const dict = available.find(l => l.code === lang)
  const isRtl = dict ? dict.is_rtl : true

  return (
    <LangCtx.Provider value={{ lang, setLang, t, available, isRtl }}>
      {children}
    </LangCtx.Provider>
  )
}
