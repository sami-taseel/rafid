import { useState } from 'react'
import { supabase } from './supabaseClient'

const MENU = [
  { key: 'stats',      label: 'الرئيسية',       icon: '📊' },
  { key: 'students',   label: 'الطلاب',        icon: '👥' },
  { key: 'tracks',     label: 'المسارات والأنشطة', icon: '📚' },
  { key: 'attendance', label: 'الحضور',        icon: '✓' },
  { key: 'buildings',  label: 'العمارات',       icon: '🏗️' },
  { key: 'housing',    label: 'السكن والمخالفات', icon: '🏢' },
  { key: 'surveys',    label: 'الاستبانات',     icon: '📋' },
  { key: 'support',    label: 'الدعم',          icon: '🎁' },
  { key: 'fields',     label: 'أسئلة النموذج',  icon: '⚙️' },
]

export default function Layout({ active, onNavigate, children }) {
  const [open, setOpen] = useState(false)
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
        <button className="nav-item logout" onClick={handleLogout}>
          <span className="nav-icon">⏏</span>تسجيل الخروج
        </button>
      </aside>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)}></div>}

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen(!open)}>☰</button>
          <span className="topbar-title">{MENU.find(m => m.key === active)?.label}</span>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
