import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useLang } from '../i18n/LangContext'

export default function StudentHome({ studentId, onGoTab }) {
  const [data, setData] = useState(null)
  const { t } = useLang()

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const { data: visIds } = await supabase.rpc('visible_activity_ids')
      const visible = (visIds || []).map(x => typeof x === 'object' ? x.visible_activity_ids : x)
      const [att, sessions, surveys, notifs] = await Promise.all([
        supabase.from('attendance').select('status').eq('student_id', studentId),
        supabase.from('sessions').select('id, planned_date, status, activity_id, activities(title, activity_type, location, tracks(name_ar))')
          .gte('planned_date', today).order('planned_date').limit(40),
        supabase.from('surveys').select('id').eq('is_active', true),
        supabase.from('notifications').select('id, title, body, kind, created_at, is_read')
          .eq('student_id', studentId).order('created_at', { ascending: false }).limit(3),
      ])
      // فلترة الجلسات حسب الأنشطة المرئية للطالب (فئاته المستهدفة)
      const visSet = new Set(visible)
      const filteredSessions = (sessions.data || []).filter(s => visSet.has(s.activity_id))
      const a = att.data || []
      setData({
        present: a.filter(x => x.status === 'present').length,
        absent: a.filter(x => x.status === 'absent').length,
        total: a.length,
        upcoming: filteredSessions.filter(s => s.status === 'scheduled' || s.status === 'held').slice(0, 8),
        surveysCount: (surveys.data || []).length,
        notifs: notifs.data || [],
      })
    }
    if (studentId) load()
  }, [studentId])

  if (!data) return <div className="state"><div className="spinner"></div>…</div>

  const attRate = data.total ? Math.round(data.present / (data.present + data.absent || 1) * 100) : null
  const next = data.upcoming[0]
  const dayName = (d) => ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][new Date(d).getDay()]

  return (
    <div className="st-home">
      {/* أقرب موعد قادم */}
      {next ? (
        <div className="next-card">
          <div className="next-label">📌 أقرب موعد قادم</div>
          <div className="next-title">{next.activities?.title}</div>
          <div className="next-meta">
            <span>🗓️ {dayName(next.planned_date)} {next.planned_date}</span>
            {next.activities?.location && <span>📍 {next.activities.location}</span>}
          </div>
          {next.activities?.tracks?.name_ar && <span className="pill">{next.activities.tracks.name_ar}</span>}
        </div>
      ) : (
        <div className="next-card empty-next">لا توجد مواعيد قادمة حالياً</div>
      )}

      {/* إحصاءات الطالب */}
      <div className="st-stats">
        <div className="st-stat"><div className="st-num">{attRate !== null ? attRate + '%' : '—'}</div><div className="st-lbl">نسبة حضوري</div></div>
        <div className="st-stat"><div className="st-num">{data.present}</div><div className="st-lbl">مرات الحضور</div></div>
        <div className="st-stat"><div className="st-num">{data.upcoming.length}</div><div className="st-lbl">مواعيد قادمة</div></div>
        <div className="st-stat"><div className="st-num">{data.surveysCount}</div><div className="st-lbl">استبانات متاحة</div></div>
      </div>

      {/* المواعيد القادمة */}
      <div className="st-section">
        <h3>المواعيد القادمة</h3>
        {data.upcoming.length === 0 && <div className="muted">لا توجد مواعيد مجدولة.</div>}
        {data.upcoming.map(s => (
          <div key={s.id} className="upcoming-row">
            <div className="up-date">
              <div className="up-day">{dayName(s.planned_date)}</div>
              <div className="up-num">{s.planned_date?.slice(8,10)}</div>
            </div>
            <div className="up-info">
              <div className="up-title">{s.activities?.title}</div>
              <div className="up-sub">{s.activities?.tracks?.name_ar} {s.activities?.location && '· ' + s.activities.location}</div>
            </div>
          </div>
        ))}
      </div>

      {/* روابط سريعة */}
      <div className="quick-links">
        <button onClick={() => onGoTab('surveys')} className="quick-link">📋 الاستبانات المتاحة</button>
        <button onClick={() => onGoTab('data')} className="quick-link">📝 إكمال بياناتي</button>
        <button onClick={() => onGoTab('policy')} className="quick-link">📜 لائحة السكن</button>
      </div>

      {/* آخر الإشعارات */}
      {data.notifs.length > 0 && (
        <div className="st-section">
          <h3>آخر الإشعارات</h3>
          {data.notifs.map(n => (
            <div key={n.id} className={'home-notif ' + n.kind}>
              <div className="hn-title">{n.title}</div>
              {n.body && <div className="hn-body">{n.body}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
