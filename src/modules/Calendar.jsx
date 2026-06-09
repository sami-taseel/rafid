import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { formatTime } from '../dateUtils'

const DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function Calendar() {
  const [sessions, setSessions] = useState([])
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(new Date())
  const [fTrack, setFTrack] = useState('')
  const [dayDetail, setDayDetail] = useState(null)

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([
        supabase.from('sessions').select('id, planned_date, start_time, title, status, activities(title, location, track_id, tracks(name_ar, code))'),
        supabase.from('tracks').select('id, name_ar, code').order('name_ar'),
      ])
      setSessions(s.data || []); setTracks(t.data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spinner />

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const visible = fTrack ? sessions.filter(s => s.activities?.track_id === fTrack) : sessions
  function sessionsOn(d) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return visible.filter(s => s.planned_date === ds).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''))
  }
  const sessName = (s) => s.title || s.activities?.title || 'جلسة'
  const today = new Date()
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const monthCount = visible.filter(s => s.planned_date?.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).length

  return (
    <div>
      <div className="cal-head">
        <button className="mini" onClick={() => setCursor(new Date(year, month-1, 1))}>← السابق</button>
        <h3>{MONTHS[month]} {year} <span className="muted" style={{ fontSize: 13 }}>({monthCount} حدث)</span></h3>
        <button className="mini" onClick={() => setCursor(new Date(year, month+1, 1))}>التالي →</button>
      </div>

      <div className="cal-toolbar">
        <select value={fTrack} onChange={e => setFTrack(e.target.value)}>
          <option value="">كل المسارات</option>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
        </select>
        <button className="mini" onClick={() => setCursor(new Date())}>اليوم</button>
      </div>

      <div className="calendar">
        {DAYS.map(d => <div key={d} className="cal-dayname">{d}</div>)}
        {cells.map((d, i) => {
          const evs = d ? sessionsOn(d) : []
          return (
            <div key={i} className={'cal-cell' + (d ? '' : ' empty') + (isToday(d) ? ' today' : '')}>
              {d && <>
                <span className="cal-num">{d}</span>
                {evs.slice(0, 3).map(s => (
                  <div key={s.id} className={'cal-event track-' + (s.activities?.tracks?.code || 'x')}
                    title={sessName(s)} onClick={() => setDayDetail({ date: d, list: evs })}>
                    {s.start_time && <span className="cal-time">{formatTime(s.start_time)}</span>} {sessName(s)}
                  </div>
                ))}
                {evs.length > 3 && <div className="cal-more" onClick={() => setDayDetail({ date: d, list: evs })}>+{evs.length - 3} المزيد</div>}
              </>}
            </div>
          )
        })}
      </div>

      {tracks.length > 0 && (
        <div className="cal-legend">
          {tracks.map(t => <span key={t.id} className={'legend-item track-' + t.code}>{t.name_ar}</span>)}
        </div>
      )}

      {dayDetail && (
        <div className="modal-overlay" onClick={() => setDayDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <h2>{dayDetail.date} {MONTHS[month]} — {dayDetail.list.length} حدث</h2>
              <button className="icon-btn" onClick={() => setDayDetail(null)}>✕</button>
            </div>
            {dayDetail.list.map(s => (
              <div key={s.id} className="day-event-row">
                <div className="day-event-time">{s.start_time ? formatTime(s.start_time) : '—'}</div>
                <div>
                  <div className="day-event-title">{sessName(s)}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {s.activities?.title}{s.activities?.tracks?.name_ar && ' · ' + s.activities.tracks.name_ar}{s.activities?.location && ' · ' + s.activities.location}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
