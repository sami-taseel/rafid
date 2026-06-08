import { useState } from 'react'

// غلاف صفحة بتبويبات داخلية — يُستخدم في صفحات اللوحة المدموجة
// tabs: [{ key, label, el }]
export default function TabGroup({ tabs }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find(t => t.key === active)
  return (
    <div>
      <div className="tabgroup-bar">
        {tabs.map(t => (
          <button key={t.key} className={'tabgroup-btn' + (active === t.key ? ' on' : '')}
            onClick={() => setActive(t.key)}>{t.label}</button>
        ))}
      </div>
      <div className="tabgroup-body">{current?.el}</div>
    </div>
  )
}
