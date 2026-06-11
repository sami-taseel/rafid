import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatTime } from '../dateUtils'

const DOW = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// تقويم الطالب: يعرض جلسات الأنشطة المرتبطة بفئته فقط
export default function StudentCalendar({ studentId }) {
  const [sessions, setSessions] = useState([])
  const [cur, setCur] = useState(new Date())
  const [daySel, setDaySel] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // الأنشطة الظاهرة للطالب (حسب فئته)
      const { data: visIds } = await supabase.rpc('visible_activity_ids')
      const ids = (visIds || []).map(x => x.id || x)
      let q = supabase.from('sessions').select('id, planned_date, start_time, title, status, activities(title, location, tracks(name_ar, code))')
      if (ids.length) q = q.in('activity_id', ids)
      const { data } = await q
      setSessions(data || []); setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) return <div className="state"><div className="spinner"></div>…</div>

  const year = cur.getFullYear(), month = cur.getMonth()
  const first = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const sessionsOn = d => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return sessions.filter(s => s.planned_date === ds).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  }
  const today = new Date()
  const isToday = d => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d
  const monthCount = sessions.filter(s => s.planned_date?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length

  return (
    <div className="st-cal">
      <div className="st-cal-bar">
        <button className="mini" onClick={() => setCur(new Date(year, month - 1, 1))}>‹</button>
        <div className="st-cal-title">{MON[month]} {year} <span className="muted">({monthCount} نشاط)</span></div>
        <button className="mini" onClick={() => setCur(new Date(year, month + 1, 1))}>›</button>
      </div>
      <button className="mini st-cal-today" onClick={() => setCur(new Date())}>اليوم</button>

      <div className="st-cal-grid">
        {DOW.map(d => <div key={d} className="st-cal-dow">{d.slice(0, 3)}</div>)}
        {Array.from({ length: first }).map((_, i) => <div key={'e' + i} className="st-cal-cell empty"></div>)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1, ss = sessionsOn(d)
          return (
            <button key={d} className={'st-cal-cell' + (isToday(d) ? ' today' : '') + (ss.length ? ' has' : '')}
              onClick={() => ss.length && setDaySel({ d, ss })}>
              <span className="st-cal-num">{d}</span>
              {ss.length > 0 && <span className="st-cal-dot">{ss.length}</span>}
            </button>
          )
        })}
      </div>

      {/* قائمة الأنشطة القادمة */}
      <div className="st-cal-upcoming">
        <h4>الأنشطة القادمة</h4>
        {sessions.filter(s => s.planned_date >= today.toISOString().slice(0, 10)).sort((a, b) => a.planned_date.localeCompare(b.planned_date)).slice(0, 8).map(s => (
          <div key={s.id} className="st-cal-item">
            <div className="st-cal-item-date">
              <div className="d-num">{s.planned_date?.slice(8, 10)}</div>
              <div className="d-mon">{MON[parseInt(s.planned_date?.slice(5, 7)) - 1]?.slice(0, 3)}</div>
            </div>
            <div className="st-cal-item-body">
              <div className="st-cal-item-title">{s.title || s.activities?.title || 'نشاط'}</div>
              <div className="st-cal-item-meta">{s.activities?.tracks?.name_ar}{s.activities?.location && ` · ${s.activities.location}`}{s.start_time && ` · ${formatTime(s.start_time)}`}</div>
            </div>
          </div>
        ))}
        {sessions.filter(s => s.planned_date >= today.toISOString().slice(0, 10)).length === 0 && <div className="muted" style={{ fontSize: 13 }}>لا أنشطة قادمة.</div>}
      </div>

      {daySel && (
        <div className="confirm-overlay" onClick={() => setDaySel(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'right' }}>
            <div className="confirm-title">{daySel.d} {MON[month]}</div>
            {daySel.ss.map(s => (
              <div key={s.id} className="st-cal-day-item">
                <strong>{s.title || s.activities?.title}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{s.activities?.tracks?.name_ar}{s.start_time && ` · ${formatTime(s.start_time)}`}{s.activities?.location && ` · ${s.activities.location}`}</div>
              </div>
            ))}
            <div className="confirm-actions"><button className="confirm-ok" onClick={() => setDaySel(null)}>إغلاق</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
