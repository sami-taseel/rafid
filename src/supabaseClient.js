import { createClient } from '@supabase/supabase-js'

// تُقرأ هذه القيم من متغيرات البيئة (نضبطها في Firebase/GitHub لاحقاً)
// أثناء التطوير المحلي تُقرأ من ملف .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
