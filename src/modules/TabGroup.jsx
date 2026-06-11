import { useState } from 'react'

// غلاف صفحة بتبويبات داخلية — يُستخدم في صفحات اللوحة المدموجة
// tabs: [{ key, label, el, badge }]  — badge: رقم يظهر بالأحمر
export default function TabGroup({ tabs }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find(t => t.key === active)
  return (
    <div>
      <div className="tabgroup-bar">
        {tabs.map(t => (
          <button key={t.key} className={'tabgroup-btn' + (active === t.key ? ' on' : '')}
            onClick={() => setActive(t.key)}>
            {t.label}
            {t.badge > 0 && <span className="tabgroup-badge">{t.badge}</span>}
          </button>
        ))}
      </div>
      <div className="tabgroup-body">{current?.el}</div>
    </div>
  )
}
