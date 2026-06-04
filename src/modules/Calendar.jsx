import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

const DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function Calendar() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(new Date())

  useEffect(() => {
    supabase.from('sessions').select('id, planned_date, status, activities(title, tracks(name_ar))')
      .then(({ data }) => { setSessions(data || []); setLoading(false) })
  }, [])

  if (loading) return <Spinner />

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function sessionsOn(d) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return sessions.filter(s => s.planned_date === ds)
  }

  return (
    <div>
      <div className="cal-head">
        <button className="mini" onClick={() => setCursor(new Date(year, month-1, 1))}>← السابق</button>
        <h3>{MONTHS[month]} {year}</h3>
        <button className="mini" onClick={() => setCursor(new Date(year, month+1, 1))}>التالي →</button>
      </div>
      <div className="calendar">
        {DAYS.map(d => <div key={d} className="cal-dayname">{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} className={'cal-cell' + (d ? '' : ' empty')}>
            {d && <>
              <span className="cal-num">{d}</span>
              {sessionsOn(d).map(s => (
                <div key={s.id} className={'cal-event status-' + s.status} title={s.activities?.title}>
                  {s.activities?.title || 'جلسة'}
                </div>
              ))}
            </>}
          </div>
        ))}
      </div>
    </div>
  )
}
