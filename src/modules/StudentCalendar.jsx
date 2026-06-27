import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatTime } from '../dateUtils'

const DOW = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// تقويم الطالب: يعرض جلسات الأنشطة المرتبطة بفئته فقط
export default function StudentCalendar({ studentId }) {
  const [sessions, setSessions] = useState([])
  const [cur, setCur] = useState(new Date())        // شهر التقويم المعروض
  const [actMonth, setActMonth] = useState(new Date()) // شهر «الأنشطة القادمة»
  const [daySel, setDaySel] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: visIds } = await supabase.rpc('visible_activity_ids')
      const ids = (visIds || []).map(x => (typeof x === 'object' && x !== null) ? (x.visible_activity_ids || x.id) : x).filter(Boolean)
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

  // أنشطة شهر «الأنشطة القادمة» — نُخفي ما فات وقته (يبقى ظاهراً في التقويم عند التنقّل للسابق)
  const aMonthStr = `${actMonth.getFullYear()}-${String(actMonth.getMonth() + 1).padStart(2, '0')}`
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const monthActivities = sessions.filter(s => s.planned_date?.startsWith(aMonthStr) && s.planned_date >= todayStr)
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date) || (a.start_time || '').localeCompare(b.start_time || ''))

  return (
    <div className="st-cal">
      {/* شريط التنقّل بين الأشهر */}
      <div className="st-cal-bar">
        <button className="cal-nav" onClick={() => setCur(new Date(year, month - 1, 1))} aria-label="السابق">‹</button>
        <div className="st-cal-title-wrap">
          <div className="st-cal-title">{MON[month]} {year}<span className="st-cal-count">{monthCount} نشاط</span></div>
          <button className="cal-today-link" onClick={() => setCur(new Date())}>↺ العودة لليوم</button>
        </div>
        <button className="cal-nav" onClick={() => setCur(new Date(year, month + 1, 1))} aria-label="التالي">›</button>
      </div>

      <div className="st-cal-grid">
        {DOW.map(d => <div key={d} className="st-cal-dow">{d}</div>)}
        {Array.from({ length: first }).map((_, i) => <div key={'e' + i} className="st-cal-cell empty"></div>)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1, ss = sessionsOn(d)
          return (
            <button key={d} className={'st-cal-cell' + (isToday(d) ? ' today' : '') + (ss.length ? ' has' : '')}
              onClick={() => ss.length && setDaySel({ d, ss })} disabled={!ss.length && !isToday(d)}>
              {isToday(d) && <span className="st-cal-todaylbl">اليوم</span>}
              <span className="st-cal-num">{d}</span>
              {ss.length > 0 && <span className="st-cal-dot">{ss.length}</span>}
            </button>
          )
        })}
      </div>

      {/* الأنشطة القادمة — بطاقات متجاورة + تنقّل بين الأشهر */}
      <div className="st-cal-upcoming">
        <div className="st-cal-up-head">
          <h4>الأنشطة القادمة</h4>
          <div className="st-cal-up-nav">
            <button className="cal-nav sm" onClick={() => setActMonth(new Date(actMonth.getFullYear(), actMonth.getMonth() - 1, 1))}>‹</button>
            <span className="st-cal-up-month">{MON[actMonth.getMonth()]} {actMonth.getFullYear()}</span>
            <button className="cal-nav sm" onClick={() => setActMonth(new Date(actMonth.getFullYear(), actMonth.getMonth() + 1, 1))}>›</button>
          </div>
        </div>
        {monthActivities.length === 0 && <div className="muted" style={{ fontSize: 13 }}>لا أنشطة في هذا الشهر.</div>}
        <div className="act-grid">
          {monthActivities.map(s => (
            <div key={s.id} className="act-card">
              <div className="act-card-date">
                <div className="act-d-dow">{DOW[new Date(s.planned_date).getDay()]}</div>
                <div className="act-d-num">{s.planned_date?.slice(8, 10)}</div>
                <div className="act-d-mon">{MON[parseInt(s.planned_date?.slice(5, 7)) - 1]}</div>
              </div>
              <div className="act-card-body">
                <div className="act-card-title">{s.title || s.activities?.title || 'نشاط'}</div>
                <div className="act-card-meta">
                  {s.start_time && <span>🕐 {formatTime(s.start_time)}</span>}
                  {s.activities?.location && <span>📍 {s.activities.location}</span>}
                </div>
                {s.activities?.tracks?.name_ar && <span className="act-pill">{s.activities.tracks.name_ar}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {daySel && (
        <div className="confirm-overlay" onClick={() => setDaySel(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'right' }}>
            <div className="confirm-title">{DOW[new Date(year, month, daySel.d).getDay()]} {daySel.d} {MON[month]}</div>
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
