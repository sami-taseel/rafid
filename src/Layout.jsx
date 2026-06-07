import { useState } from 'react'
import { useDarkMode } from './useDarkMode'
import { supabase } from './supabaseClient'

const MENU = [
  { key: 'stats',      label: 'الرئيسية',       icon: '📊' },
  { key: 'students',   label: 'الطلاب',        icon: '👥' },
  { key: 'tracks',     label: 'المسارات والأنشطة', icon: '📚' },
  { key: 'categories', label: 'الفئات والتصنيفات', icon: '🏷️' },
  { key: 'attendance', label: 'الحضور',        icon: '✓' },
  { key: 'calendar',   label: 'التقويم',        icon: '🗓️' },
  { key: 'buildings',  label: 'العمارات',       icon: '🏗️' },
  { key: 'housing',    label: 'السكن والمخالفات', icon: '🏢' },
  { key: 'policy',     label: 'لائحة السكن',    icon: '📜' },
  { key: 'surveys',    label: 'الاستبانات',     icon: '📋' },
  { key: 'support',    label: 'الدعم',          icon: '🎁' },
  { key: 'reports',    label: 'التقارير',       icon: '📤' },
  { key: 'users',      label: 'المستخدمون',     icon: '🔑' },
  { key: 'sponsor',    label: 'لوحة الراعي',    icon: '📈' },
  { key: 'audit',      label: 'سجل العمليات',   icon: '📜' },
  { key: 'fields',     label: 'أسئلة النموذج',  icon: '⚙️' },
  { key: 'tickets',    label: 'البلاغات',        icon: '📨' },
  { key: 'tickets_admin', label: 'إعداد البلاغات', icon: '🎫' },
  { key: 'languages',  label: 'اللغات',         icon: '🌐' },
]

export default function Layout({ active, onNavigate, children }) {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useDarkMode()
  async function handleLogout() { await supabase.auth.signOut() }

  return (
    <div className="layout">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-brand">
          <img src="/logo-white.png" alt="تأصيل" />
          <div><h1>منصة رافد</h1><span>لوحة الإدارة</span></div>
        </div>
        <nav>
          {MENU.map(m => (
            <button key={m.key}
              className={active === m.key ? 'nav-item active' : 'nav-item'}
              onClick={() => { onNavigate(m.key); setOpen(false) }}>
              <span className="nav-icon">{m.icon}</span>{m.label}
            </button>
          ))}
        </nav>

      </aside>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)}></div>}

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen(!open)}>☰</button>
          <span className="topbar-title">{MENU.find(m => m.key === active)?.label}</span>
          <div className="topbar-actions">
            <button className="icon-act" onClick={() => setDark(!dark)} aria-label="الوضع الليلي" title="الوضع الليلي">{dark ? '☀️' : '🌙'}</button>
            <button className="icon-act" onClick={handleLogout} aria-label="تسجيل الخروج" title="تسجيل الخروج">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
