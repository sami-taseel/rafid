import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatTime, formatDate } from '../dateUtils'
import { useLang } from '../i18n/LangContext'
import Icon from '../Icon'
import ExcuseButton from './ExcuseButton'
import SessionCard from './SessionCard'

export default function StudentHome({ studentId, onGoTab, isFull = true }) {
  const [points, setPoints] = useState(0)
  const [pending, setPending] = useState([])
  const [data, setData] = useState(null)
  const { t } = useLang()
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const { data: visIds } = await supabase.rpc('visible_activity_ids')
      const visible = (visIds || []).map(x => typeof x === 'object' ? x.visible_activity_ids : x)
      const [att, sessions, surveys, notifs] = await Promise.all([
        supabase.from('attendance').select('status').eq('student_id', studentId),
        supabase.from('sessions').select('id, planned_date, status, activity_id, title, start_time, duration_min, activities(title, activity_type, provider, location, tracks(name_ar))')
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
        upcoming: filteredSessions.filter(s => s.status === 'scheduled' || s.status === 'held'),
        surveysCount: (surveys.data || []).length,
        notifs: notifs.data || [],
      })
    }
    if (studentId) load()
  }, [studentId])

  useEffect(() => {
    if (!studentId) return
    supabase.rpc('student_points', { p_student: studentId }).then(({ data, error }) => { if (!error) setPoints(data || 0) }, () => {})
    // الموافقات المعلّقة بعد تحديث جوهري
    supabase.from('form_records').select('id, form_templates(title)').eq('student_id', studentId).eq('status', 'pending')
      .then(({ data }) => setPending(data || [])).catch(() => {})
  }, [studentId])

  if (!data) return <div className="state"><div className="spinner"></div>…</div>

  const attRate = data.total ? Math.round(data.present / (data.present + data.absent || 1) * 100) : null
  const dayName = (d) => ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][new Date(d).getDay()]
  // أقرب موعد = كل جلسات أقرب يوم فيه مواعيد
  const nextDay = data.upcoming.length ? data.upcoming[0].planned_date : null
  const nextDaySessions = data.upcoming.filter(s => s.planned_date === nextDay)
  const sessName = (s) => s.title || s.activities?.title || 'جلسة'
  const ROWS_LIMIT = 6
  const shownUpcoming = data.upcoming.slice(0, ROWS_LIMIT)

  return (
    <div className="st-home">
      {pending.length > 0 && (
        <div className="pending-banner" onClick={() => onGoTab && onGoTab('forms')}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <div>
            <strong>لديك {pending.length} نموذج بحاجة لإعادة موافقة</strong>
            <div style={{ fontSize: 13, opacity: .9 }}>تم تحديثها — اضغط للمراجعة والموافقة</div>
          </div>
        </div>
      )}

      {points > 0 && (
        <div className="points-banner">
          <div className="points-icon">⭐</div>
          <div>
            <div className="points-num">{points} نقطة</div>
            <div className="points-lbl">{badgeFor(points)}</div>
          </div>
        </div>
      )}

      {/* أقرب موعد قادم */}
      {nextDaySessions.length > 0 ? (
        <div className="next-wrap">
          <div className="next-head"><Icon name="pin" size={16} /> أقرب موعد قادم — {dayName(nextDay)}، {formatDate(nextDay)}</div>
          <div className="sc-grid">
            {nextDaySessions.map(s => (
              <SessionCard key={s.id} session={s} variant="feature" showDate={false}
                footer={<ExcuseButton studentId={studentId} sessionId={s.id} sessionTitle={sessName(s)} sessionDate={dayName(s.planned_date) + '، ' + formatDate(s.planned_date)} />} />
            ))}
          </div>
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

      {/* المواعيد القادمة — للحساب المكتمل فقط */}
      {isFull && <div className="st-section">
        <div className="st-section-head">
          <h3>المواعيد القادمة {data.upcoming.length > 0 && <span className="muted" style={{fontSize:13}}>({data.upcoming.length})</span>}</h3>
          {data.upcoming.length > 0 && (
            <button className="section-link" onClick={() => onGoTab && onGoTab('calendar')}>الكل ←</button>
          )}
        </div>
        {data.upcoming.length === 0 && <div className="muted">لا توجد مواعيد مجدولة.</div>}
        <div className="sc-grid">
          {shownUpcoming.map(s => (
            <SessionCard key={s.id} session={s} variant="list"
              footer={<ExcuseButton studentId={studentId} sessionId={s.id} sessionTitle={sessName(s)} sessionDate={dayName(s.planned_date) + '، ' + formatDate(s.planned_date)} />} />
          ))}
        </div>
      </div>}
    </div>
  )
}

function badgeFor(p) {
  if (p >= 500) return '🏆 طالب متميّز'
  if (p >= 300) return '🥇 طالب نشيط'
  if (p >= 150) return '🥈 طالب مواظب'
  if (p >= 50) return '🥉 بداية موفّقة'
  return 'واصل التقدّم!'
}
