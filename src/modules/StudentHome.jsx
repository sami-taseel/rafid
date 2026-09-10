import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { formatTime, formatDate } from '../dateUtils'
import { useLang } from '../i18n/LangContext'
import Icon from '../Icon'
import PauseRequest from './PauseRequest'
import { FeatureCard, CompactCard } from './SessionCard'

export default function StudentHome({ studentId, onGoTab, isFull = true }) {
  const [showAbsent, setShowAbsent] = useState(false)
  const [points, setPoints] = useState(0)
  const [pending, setPending] = useState([])
  const [data, setData] = useState(null)
  const { t } = useLang()
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function load() {
     try {
      const today = new Date().toISOString().slice(0, 10)
      const { data: visIds } = await supabase.rpc('visible_activity_ids')
      const visible = (visIds || []).map(x => typeof x === 'object' ? x.visible_activity_ids : x)
      const [att, sessions, surveys, notifs] = await Promise.all([
        supabase.from('attendance').select('status, session_id').eq('student_id', studentId),
        supabase.from('sessions').select('id, planned_date, status, activity_id, title, start_time, duration_min, recording_url, activities(title, activity_type, provider, location, tracks(name_ar))')
          .gte('planned_date', today).order('planned_date').limit(40),
        supabase.from('surveys').select('id').eq('is_active', true),
        supabase.from('notifications').select('id, title, body, kind, created_at, is_read')
          .eq('student_id', studentId).order('created_at', { ascending: false }).limit(3),
      ])
      const a = att.data || []
      // جلسات الغياب: نجلب تفاصيلها لعرضها عند الضغط على نسبة الغياب
      const absentIds = a.filter(x => x.status === 'absent').map(x => x.session_id).filter(Boolean)
      let absentSessions = []
      if (absentIds.length) {
        const { data: abs } = await supabase.from('sessions')
          .select('id, planned_date, status, activity_id, title, start_time, duration_min, recording_url, activities(title, activity_type, provider, location, tracks(name_ar))')
          .in('id', absentIds).order('planned_date', { ascending: false })
        absentSessions = abs || []
      }

      const visSet = new Set(visible)
      // هل الطالب مشرف تحضير؟
      let monitor = false
      try {
        const { data: mv } = await supabase.rpc('am_i_monitor')
        monitor = !!mv
      } catch { /* العمود قد لا يكون منفّذاً بعد */ }
      // نوع الاستهداف لكل نشاط (يحسب الفئات اليدوية والتلقائية خادمياً)
      const typeMap = {}
      try {
        const { data: tt } = await supabase.rpc('my_target_types')
        ;(tt || []).forEach(x => { typeMap[x.activity_id] = x.target_type })
      } catch { /* الدالة قد لا تكون منفّذة بعد */ }
      const filteredSessions = (sessions.data || []).filter(s => visSet.has(s.activity_id))
      // خريطة: معرّف الجلسة → حالة حضور الطالب فيها
      const attMap = {}
      a.forEach(x => { if (x.session_id) attMap[x.session_id] = x.status })
      setData({
        present: a.filter(x => x.status === 'present').length,
        absent: a.filter(x => x.status === 'absent').length,
        excused: a.filter(x => x.status === 'excused').length,
        recorded: a.filter(x => x.status === 'recorded').length,
        total: a.length,
        upcoming: filteredSessions.filter(s => s.status === 'scheduled' || s.status === 'held'),
        attMap, typeMap, monitor, absentSessions,
        surveysCount: (surveys.data || []).length,
        notifs: notifs.data || [],
      })
     } catch (err) {
      console.error('تحميل صفحة الطالب:', err)
      // نعرض الصفحة بحد أدنى بدل دائرة معلّقة
      setData({ present: 0, absent: 0, excused: 0, recorded: 0, total: 0,
        upcoming: [], attMap: {}, typeMap: {}, monitor: false,
        absentSessions: [], surveysCount: 0, notifs: [], loadError: true })
     }
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

  // الإجمالي المحسوم = حاضر + مستأذن + استماع + غائب
  const decidedTotal = (data.present || 0) + (data.excused || 0) + (data.recorded || 0) + (data.absent || 0)
  const pct = n => decidedTotal ? Math.round((n || 0) / decidedTotal * 100) : null
  const attRate = pct((data.present || 0) + (data.recorded || 0))
  const excRate = pct(data.excused)
  const absRate = pct(data.absent)
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
          <div className="fc-grid">
            {nextDaySessions.map(s => (
              <FeatureCard key={s.id} session={s} studentId={studentId} attStatus={data.attMap[s.id]} targetType={data.typeMap?.[s.activity_id]} isMonitor={data.monitor} onAttChange={(sid, st) => setData(d => ({ ...d, attMap: { ...d.attMap, [sid]: st } }))}
                sessionDate={dayName(s.planned_date) + '، ' + formatDate(s.planned_date)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="next-card empty-next">لا توجد مواعيد قادمة حالياً</div>
      )}

      {/* إحصاءات الطالب */}
      <div className="sts-grid">
        <div className="sts-card present">
          <div className="sts-ic"><Icon name="check" size={18} /></div>
          <div className="sts-num">{attRate !== null ? attRate + '%' : '—'}</div>
          <div className="sts-lbl">نسبة الحضور</div>
          {decidedTotal > 0 && <div className="sts-sub">{(data.present || 0) + (data.recorded || 0)} من {decidedTotal}</div>}
        </div>
        <div className="sts-card excused">
          <div className="sts-ic"><Icon name="hand" size={18} /></div>
          <div className="sts-num">{excRate !== null ? excRate + '%' : '—'}</div>
          <div className="sts-lbl">نسبة الاستئذان</div>
          {decidedTotal > 0 && <div className="sts-sub">{data.excused || 0} من {decidedTotal}</div>}
        </div>
        <div className={'sts-card absent' + ((data.absent || 0) > 0 ? ' clickable' : '')}
          onClick={() => (data.absent || 0) > 0 && setShowAbsent(true)}
          role={(data.absent || 0) > 0 ? 'button' : undefined}
          title={(data.absent || 0) > 0 ? 'اضغط لعرض الأنشطة التي غبت عنها' : undefined}>
          <div className="sts-ic"><Icon name="x" size={18} /></div>
          <div className="sts-num">{absRate !== null ? absRate + '%' : '—'}</div>
          <div className="sts-lbl">نسبة الغياب</div>
          {decidedTotal > 0 && <div className="sts-sub">{data.absent || 0} من {decidedTotal}</div>}
          {(data.absent || 0) > 0 && (
            <div className="sts-cta">تدارَكها الآن <Icon name="chevronLeft" size={12} /></div>
          )}
        </div>
        <div className="sts-card upcoming">
          <div className="sts-ic"><Icon name="calendar" size={18} /></div>
          <div className="sts-num">{data.upcoming.length}</div>
          <div className="sts-lbl">المواعيد القادمة</div>
        </div>
        <div className="sts-card surveys">
          <div className="sts-ic"><Icon name="clipboard" size={18} /></div>
          <div className="sts-num">{data.surveysCount}</div>
          <div className="sts-lbl">الاستبانات المتاحة</div>
        </div>
      </div>

      {/* المواعيد القادمة — للحساب المكتمل فقط */}
      {isFull && <div className="st-section">
        <div className="up-head">
          <div className="up-head-main">
            <div className="up-head-ic"><Icon name="calendar" size={19} /></div>
            <div className="up-head-text">
              <h3 className="up-title">المواعيد القادمة</h3>
              {data.upcoming.length > 0 && <span className="up-count">{data.upcoming.length} موعد</span>}
            </div>
          </div>
          <div className="up-head-actions">
            {studentId && <PauseRequest studentId={studentId} />}
            {data.upcoming.length > 0 && (
              <button className="up-all" onClick={() => onGoTab && onGoTab('calendar')}>
                الكل <Icon name="chevronLeft" size={15} />
              </button>
            )}
          </div>
        </div>
        {data.upcoming.length === 0 && <div className="muted">لا توجد مواعيد مجدولة.</div>}
        <div className="cc-grid">
          {shownUpcoming.map(s => (
            <CompactCard key={s.id} session={s} studentId={studentId} attStatus={data.attMap[s.id]} targetType={data.typeMap?.[s.activity_id]} isMonitor={data.monitor} onAttChange={(sid, st) => setData(d => ({ ...d, attMap: { ...d.attMap, [sid]: st } }))}
              sessionDate={dayName(s.planned_date) + '، ' + formatDate(s.planned_date)} />
          ))}
        </div>
      </div>}

      {/* نافذة الأنشطة التي غاب عنها — لتداركها */}
      {showAbsent && createPortal(
        <div className="abs-overlay" onClick={() => setShowAbsent(false)}>
          <div className="abs-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="abs-hero">
              <button className="abs-close" onClick={() => setShowAbsent(false)} aria-label="إغلاق">
                <Icon name="x" size={18} />
              </button>
              <div className="abs-hero-ic"><Icon name="alert" size={22} /></div>
              <h3 className="abs-title">أنشطة غبت عنها</h3>
              <p className="abs-sub">
                يمكنك تدارُك الأمر: أكّد حضورك إن كنت حاضراً فعلاً، أو اطلب إذناً بعذرك.
              </p>
            </div>
            <div className="abs-body">
              {(data.absentSessions || []).length === 0 ? (
                <div className="muted" style={{ textAlign: 'center', padding: 20 }}>لا أنشطة غياب.</div>
              ) : (
                <div className="cc-grid">
                  {(data.absentSessions || []).map(s => (
                    <CompactCard key={s.id} session={s} studentId={studentId}
                      attStatus={data.attMap[s.id]}
                      targetType={data.typeMap?.[s.activity_id]}
                      isMonitor={data.monitor}
                      onAttChange={(sid, st) => setData(d => ({
                        ...d,
                        attMap: { ...d.attMap, [sid]: st },
                        // تحديث العدّاد: خرج من الغياب
                        absent: Math.max(0, (d.absent || 0) - 1),
                        present: st === 'present' ? (d.present || 0) + 1 : (d.present || 0),
                        absentSessions: (d.absentSessions || []).filter(x => x.id !== sid),
                      }))}
                      sessionDate={dayName(s.planned_date) + '، ' + formatDate(s.planned_date)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
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
