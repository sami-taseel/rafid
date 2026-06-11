import { useState, useEffect, useRef } from 'react'
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
  { key: 'reports', label: 'التقارير', icon: '📊' },
  { key: 'sponsors',   label: 'الجهات الداعمة', icon: '🤝' },
  { key: 'system',     label: 'المستخدمون والنظام', icon: '⚙️' },
  { key: 'help',       label: 'مساعدة',         icon: '❓' },
]

export default function Layout({ active, onNavigate, children }) {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useDarkMode()
  const [openTickets, setOpenTickets] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
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
      // عدد طلبات الاعتماد المنتظرة
      const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('account_state', 'pending_approval')
      setPendingApprovals(count || 0)
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
            {m.key === 'students' && pendingApprovals > 0 && <span className="nav-badge">{pendingApprovals}</span>}
            </button>
          ))}
        </nav>

      </aside>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)}></div>}

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen(!open)}>☰</button>
          <span className="topbar-title">{MENU.find(m => m.key === active)?.label}
            {active === 'tickets' && openTickets > 0 && <span className="title-badge">{openTickets}</span>}
            {active === 'students' && pendingApprovals > 0 && <span className="title-badge">{pendingApprovals}</span>}</span>
          <div className="topbar-actions">
            <StaffBell onNavigate={onNavigate} />
            <button className="icon-act" onClick={() => onNavigate('account')} aria-label="حسابي" title="حسابي">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
            </button>
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

function StaffBell({ onNavigate }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  async function load() {
    const { data } = await supabase.from('staff_notifications').select('*').order('created_at', { ascending: false }).limit(20)
    setItems(data || [])
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  const unread = items.filter(i => !i.is_read).length
  async function openPanel() {
    setOpen(!open)
    if (!open && unread) { await supabase.from('staff_notifications').update({ is_read: true }).eq('is_read', false); load() }
  }
  return (
    <div className="notif-wrap" ref={ref}>
      <button className="icon-act" onClick={openPanel} aria-label="الإشعارات" title="الإشعارات" style={{ position: 'relative' }}>
        🔔{unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">الإشعارات</div>
          {items.length === 0 && <div className="muted" style={{ padding: 14, fontSize: 13 }}>لا إشعارات.</div>}
          {items.map(n => (
            <div key={n.id} className={'notif-item' + (n.link ? ' clickable' : '')} onClick={() => { if (n.link) { onNavigate(n.link); setOpen(false) } }}>
              <div className="notif-item-title">{n.title}</div>
              {n.body && <div className="notif-item-body">{n.body}</div>}
              <div className="notif-item-time">{new Date(n.created_at).toLocaleDateString('ar')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
