import { useState, useEffect } from 'react'
import { useDarkMode } from './useDarkMode'
import { supabase } from './supabaseClient'

const MENU = [
  { key: 'stats',      label: 'الرئيسية',       icon: '📊' },
  { key: 'tickets',    label: 'البلاغات',        icon: '📨' },
  { key: 'students',   label: 'الطلاب',        icon: '👥' },
  { key: 'activities', label: 'الأنشطة',        icon: '📚' },
  { key: 'categories', label: 'الفئات والتصنيفات', icon: '🏷️' },
  { key: 'housing',    label: 'السكن',          icon: '🏢' },
  { key: 'surveys',    label: 'الاستبانات',     icon: '📋' },
  { key: 'support_reports', label: 'الدعم والتقارير', icon: '📤' },
  { key: 'sponsors',   label: 'الجهات الداعمة', icon: '🤝' },
  { key: 'system',     label: 'المستخدمون والنظام', icon: '⚙️' },
  { key: 'help',       label: 'مساعدة',         icon: '❓' },
]

export default function Layout({ active, onNavigate, children }) {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useDarkMode()
  const [openTickets, setOpenTickets] = useState(0)
  useEffect(() => {
    async function countTickets() {
      // عدد البلاغات غير المغلقة (المدير يرى الكل، المشرف بلاغات نوعه)
      const { data: au } = await supabase.auth.getUser()
      let roles = [], admin = false
      if (au?.user) {
        const { data: p } = await supabase.from('persons').select('user_roles(roles(code))').eq('auth_user_id', au.user.id).maybeSingle()
        roles = (p?.user_roles || []).map(ur => ur.roles?.code).filter(Boolean)
        admin = roles.includes('system_admin') || roles.includes('project_manager')
      }
      const { data: tk } = await supabase.from('tickets').select('status_code, ticket_types(handler_role)').neq('status_code', 'closed')
      const visible = (tk || []).filter(t => admin || (t.ticket_types?.handler_role && roles.includes(t.ticket_types.handler_role)))
      setOpenTickets(visible.length)
    }
    countTickets()
  }, [active])
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
            {m.key === 'tickets' && openTickets > 0 && <span className="nav-badge">{openTickets}</span>}
            </button>
          ))}
        </nav>

      </aside>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)}></div>}

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen(!open)}>☰</button>
          <span className="topbar-title">{MENU.find(m => m.key === active)?.label}
            {active === 'tickets' && openTickets > 0 && <span className="title-badge">{openTickets}</span>}</span>
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
