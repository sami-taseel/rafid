import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import { supabase } from '../supabaseClient'
import { formatTime, formatDuration } from '../dateUtils'
import ExcuseButton from './ExcuseButton'
import QRModal from './QRModal'

const TYPE_META = {
  'درس': { icon: 'book', color: '#2e5496' },
  'دورة': { icon: 'clipboard', color: '#6b3fc0' },
  'يوم علمي': { icon: 'star', color: '#0f9d6e' },
  'مناقشة': { icon: 'users', color: '#d97706' },
  'رحلة': { icon: 'pin', color: '#0891b2' },
  'لقاء': { icon: 'handshake', color: '#be185d' },
  'محاضرة': { icon: 'edit', color: '#4f46e5' },
}
function typeMeta(t) { return TYPE_META[t] || { icon: 'calendar', color: '#2e5496' } }
const DOW_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

function sessInfo(s) {
  const act = s.activities || {}
  const sessName = s.title || act.title || 'جلسة'
  const actTitle = act.title && act.title !== sessName ? act.title : null
  return { act, sessName, actTitle, meta: typeMeta(act.activity_type) }
}

// حالة حضور الطالب: present | absent | excused | not_recorded | undefined
// نعتبر الحالة "محسومة" إذا كانت حضر/غائب/مستأذن (نُخفي زر الإذن ونعرض شارة)
const ATT_META = {
  present: { label: 'حضرت', icon: 'check', color: '#15784e', bg: '#e3f6ed' },
  excused: { label: 'مستأذن', icon: 'hand', color: '#b3730a', bg: '#fff4e0' },
  recorded: { label: 'استماع مسجّل', icon: 'clock', color: '#6b3fc0', bg: '#f1ebfb' },
  absent: { label: 'غياب', icon: 'x', color: '#b32d2d', bg: '#fce8e8' },
  pending: { label: 'بانتظار التأكيد', icon: 'clock', color: '#b3730a', bg: '#fff4e0' },
}
function attDecided(status) { return status === 'present' || status === 'absent' || status === 'excused' || status === 'recorded' }

// شارة حالة الحضور
function AttBadge({ status, size = 'normal' }) {
  const m = ATT_META[status]
  if (!m) return null
  return (
    <span className={'att-badge att-badge-' + size} style={{ background: m.bg, color: m.color }}>
      <Icon name={m.icon} size={size === 'mini' ? 13 : 14} /> {m.label}
    </span>
  )
}

// ============ البطاقة البارزة (أقرب موعد) — مُعاد تنظيمها ============
export function FeatureCard({ session, studentId, sessionDate, attStatus, targetType }) {
  const s = session
  const { act, sessName, actTitle, meta } = sessInfo(s)
  const decided = attDecided(attStatus)
  const isOptional = targetType === 'secondary'
  const date = s.planned_date ? new Date(s.planned_date + 'T00:00:00') : null

  // العدّاد التنازلي: كم يوماً حتى الموعد
  function countdown() {
    if (!s.planned_date) return null
    const today = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00')
    const diff = Math.round((new Date(s.planned_date + 'T00:00:00') - today) / 86400000)
    if (diff < 0) return 'فات الموعد'
    if (diff === 0) return 'اليوم'
    if (diff === 1) return 'غداً'
    if (diff === 2) return 'بعد يومين'
    if (diff <= 10) return `بعد ${diff} أيام`
    return `بعد ${diff} يوماً`
  }
  const cd = countdown()

  return (
    <div className={'tl-card' + (isOptional ? ' tl-optional' : '')} style={{ '--sc-color': meta.color }}>
      {/* العمود الزمني */}
      <div className="tl-when">
        {cd && <div className="tl-countdown">{cd}</div>}
        {date && <>
          <div className="tl-dow">{DOW_AR[date.getDay()]}</div>
          <div className="tl-day">{date.getDate()}</div>
          <div className="tl-mon">{MON[date.getMonth()]}</div>
        </>}
        {s.start_time && <>
          <div className="tl-sep"></div>
          <div className="tl-time">{formatTime(s.start_time).replace('مساءً', 'م').replace('صباحاً', 'ص')}</div>
          {s.duration_min ? <div className="tl-dur">لمدة {formatDuration(s.duration_min)}</div> : null}
        </>}
      </div>

      {/* المحتوى */}
      <div className="tl-body">
        <div className="tl-tags">
          {act.tracks?.name_ar && <span className="tl-track">{act.tracks.name_ar}</span>}
          <span className="tl-type" style={{ background: meta.color + '18', color: meta.color }}>
            <Icon name={meta.icon} size={11} /> {act.activity_type || 'نشاط'}
          </span>
          {targetType && (
            <span className={'req-tag ' + (isOptional ? 'optional' : 'required')}>
              <Icon name={isOptional ? 'star' : 'alert'} size={10} /> {isOptional ? 'اختياري' : 'إلزامي'}
            </span>
          )}
        </div>

        {/* اسم النشاط بجوار اسم الجلسة، كل بتمييزه */}
        <div className="tl-names">
          <span className="tl-act" style={{ background: meta.color + '1a', color: meta.color, borderColor: meta.color + '3d' }}>
            {actTitle || sessName}
          </span>
          {actTitle && <span className="tl-sess">{sessName}</span>}
        </div>

        {/* المقدّم والمكان — كاملان ومميّزان */}
        <div className="tl-meta">
          {act.provider && (
            <div className="tl-meta-item provider">
              <span className="tl-meta-ic"><Icon name="user" size={14} /></span>
              <div className="tl-meta-text">
                <span className="tl-meta-lbl">مقدّم الجلسة</span>
                <span className="tl-meta-val">{act.provider}</span>
              </div>
            </div>
          )}
          {act.location && (
            <div className="tl-meta-item place">
              <span className="tl-meta-ic"><Icon name="pin" size={14} /></span>
              <div className="tl-meta-text">
                <span className="tl-meta-lbl">المكان</span>
                <span className="tl-meta-val">{act.location}</span>
              </div>
            </div>
          )}
        </div>

        {isOptional && (
          <div className="cc-opt-note" style={{ marginTop: 12 }}>
            <Icon name="star" size={15} />
            <span>حضورك لهذا النشاط <strong>اختياري</strong>، وتُمنح <strong>نقطة</strong> عند الحضور.</span>
          </div>
        )}
      </div>

      {/* الإجراء في الزاوية */}
      <div className="tl-action">
        {decided
          ? <AttBadge status={attStatus} size="mini" />
          : studentId && !isOptional && (
            <ExcuseButton studentId={studentId} sessionId={s.id} sessionTitle={sessName} sessionDate={sessionDate} compact />
          )}
      </div>
    </div>
  )
}

// ============ البطاقة المختصرة (بطاقتان بالصف) ============
export function CompactCard({ session, studentId, sessionDate, showExcuse = true, attStatus, targetType, isMonitor = false, onAttChange }) {
  const s = session
  const { act, sessName, actTitle, meta } = sessInfo(s)
  const [details, setDetails] = useState(false)
  const [qr, setQr] = useState(false)
  const date = s.planned_date ? new Date(s.planned_date + 'T00:00:00') : null
  const isOptional = targetType === 'secondary'
  // مشرف التحضير: الباركود متاح لجلسات اليوم والأيام السابقة
  const todayStr = new Date().toLocaleDateString('en-CA')
  const canShowQR = isMonitor && s.planned_date && s.planned_date <= todayStr
  // التحضير الذاتي: يوم الجلسة فأحدث، وما لم تُحسم الحالة إدارياً
  const [busy, setBusy] = useState(false)
  const [localStatus, setLocalStatus] = useState(null)
  const [msg, setMsg] = useState(null)
  const eff = localStatus ?? attStatus
  // إن تغيّرت الحالة من الأعلى (إعادة تحميل) نُسقط الحالة المحلية
  useEffect(() => { setLocalStatus(null) }, [attStatus])
  // متاح يوم الجلسة فأحدث، ما لم تُحسم الحالة اعتماداً (حاضر/مستأذن/استماع/بانتظار)
  // الغياب التلقائي قابل للتصحيح ذاتياً
  const canSelfCheck = s.planned_date && s.planned_date <= todayStr
    && !['present', 'pending', 'excused', 'recorded'].includes(eff)
  const selfDone = eff === 'present' || eff === 'pending'
  const decided = attDecided(eff)

  async function selfCheckIn() {
    setBusy(true)
    const { data, error } = await supabase.rpc('self_check_in', { p_session: s.id })
    setBusy(false)
    if (error) { setMsg('تعذّر تسجيل الحضور: ' + (error.message || '')); console.error('self_check_in:', error); return }
    const txt = String(data || '')
    setMsg(txt)
    if (txt.includes('تم')) {
      const next = txt.includes('تأكيد المشرف') ? 'pending' : 'present'
      setLocalStatus(next)
      onAttChange?.(s.id, next)
    }
    setTimeout(() => setMsg(null), 4000)
  }
  async function undoCheckIn() {
    setBusy(true)
    const { data, error } = await supabase.rpc('undo_check_in', { p_session: s.id })
    setBusy(false)
    if (error) { setMsg('تعذّر التراجع: ' + (error.message || '')); console.error('undo_check_in:', error); return }
    const txt = String(data || '')
    setMsg(txt)
    if (txt.startsWith('تم')) { setLocalStatus('not_recorded'); onAttChange?.(s.id, 'not_recorded') }
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <>
      <div className={'cc-card' + (decided ? ' cc-decided cc-' + eff : '') + (isOptional ? ' cc-optional' : '')} style={{ '--sc-color': meta.color }}>
        <div className="cc-stripe"></div>
        <div className="cc-body">
          <div className="cc-head">
            <div className="cc-head-tags">
              <span className="cc-type" style={{ background: meta.color + '18', color: meta.color }}>
                <Icon name={meta.icon} size={11} /> {act.activity_type || 'نشاط'}
              </span>
              {targetType && (
                <span className={'req-tag ' + (isOptional ? 'optional' : 'required')}>
                  <Icon name={isOptional ? 'star' : 'alert'} size={10} /> {isOptional ? 'اختياري' : 'إلزامي'}
                </span>
              )}
            </div>
            {decided ? <AttBadge status={eff} size="mini" /> : (date && <span className="cc-date">{DOW_AR[date.getDay()]} {date.getDate()} {MON[date.getMonth()]}</span>)}
          </div>
          {/* اسم النشاط بارز، واسم الجلسة تحته */}
          <h4 className="cc-title">{actTitle || sessName}</h4>
          {actTitle && <div className="cc-subtitle">{sessName}</div>}
          <div className="cc-foot">
            {s.start_time && <span className="cc-time"><Icon name="clock" size={13} /> {formatTime(s.start_time)}</span>}
            <div className="cc-actions">
              <button className="cc-icon-btn" onClick={() => setDetails(true)} title="التفاصيل" aria-label="التفاصيل">
                <Icon name="eye" size={15} />
              </button>
              {/* تحضير ذاتي: متاح يوم الجلسة وما بعده إن لم تُحسم الحالة */}
              {studentId && canSelfCheck && !selfDone && (
                <button className={'cc-icon-btn checkin' + (eff === 'absent' ? ' fix' : '')}
                  onClick={selfCheckIn} disabled={busy}
                  title={eff === 'absent' ? 'تصحيح الغياب وتسجيل حضوري' : 'تسجيل حضوري'}
                  aria-label="تسجيل حضوري">
                  <Icon name="check" size={15} />
                </button>
              )}
              {/* تراجع عن التحضير الذاتي */}
              {studentId && selfDone && (
                <button className="cc-icon-btn undo" onClick={undoCheckIn} disabled={busy}
                  title="التراجع عن التحضير" aria-label="التراجع عن التحضير">
                  <Icon name="refresh" size={15} />
                </button>
              )}
              {/* زر الإذن يظهر فقط إن لم تُحسم الحالة */}
              {showExcuse && studentId && !isOptional && !['present','pending','excused','recorded'].includes(eff) && (
                <ExcuseButton studentId={studentId} sessionId={s.id} sessionTitle={sessName} sessionDate={sessionDate} compact />
              )}
            </div>
          </div>
          {msg && <div className="cc-msg">{msg}</div>}
        </div>
      </div>

      {qr && <QRModal session={s} onClose={() => setQr(false)} />}

      {details && createPortal(
        <div className="cc-detail-overlay" onClick={() => setDetails(false)}>
          <div className="cc-detail-card" onClick={e => e.stopPropagation()}>
            <div className="cc-detail-hero" style={{ background: meta.color }}>
              <button className="cc-detail-close" onClick={() => setDetails(false)} aria-label="إغلاق"><Icon name="x" size={18} /></button>
              <span className="cc-detail-type"><Icon name={meta.icon} size={14} /> {act.activity_type || 'نشاط'}</span>
              <h3 className="cc-detail-title">{actTitle || sessName}</h3>
              {actTitle && <p className="cc-detail-sub">{sessName}</p>}
            </div>
            <div className="cc-detail-body">
              {decided && <div className="cc-detail-att"><AttBadge status={eff} /></div>}
              {isOptional && (
                <div className="cc-opt-note">
                  <Icon name="star" size={15} />
                  <span>حضورك لهذا النشاط <strong>اختياري</strong>، وتُمنح <strong>نقطة</strong> عند الحضور.</span>
                </div>
              )}
              {date && <DetailRow icon="calendar" label="التاريخ" value={`${DOW_AR[date.getDay()]} ${date.getDate()} ${MON[date.getMonth()]} ${date.getFullYear()}`} />}
              {s.start_time && <DetailRow icon="clock" label="الوقت" value={`${formatTime(s.start_time)}${s.duration_min ? ` · ${formatDuration(s.duration_min)}` : ''}`} />}
              {act.provider && <DetailRow icon="user" label="مقدّم الجلسة" value={act.provider} />}
              {act.location && <DetailRow icon="pin" label="المكان" value={act.location} />}
              {act.tracks?.name_ar && <DetailRow icon="tag" label="المسار" value={act.tracks.name_ar} />}
              {/* رابط تسجيل الدرس */}
              <div className="cc-detail-row cc-rec-row">
                <span className="cc-detail-ic" style={{ background: '#f1ebfb', color: '#6b3fc0' }}><Icon name="clock" size={16} /></span>
                <div className="cc-detail-text">
                  <span className="cc-detail-lbl">تسجيل الدرس</span>
                  {s.recording_url
                    ? <a className="cc-rec-link" href={s.recording_url} target="_blank" rel="noopener noreferrer">فتح رابط التسجيل 🎧</a>
                    : <span className="cc-rec-pending">سيُضاف الرابط بعد الدرس بـ٢٤ ساعة بإذن الله</span>}
                </div>
              </div>
            </div>
            {canShowQR && (
              <div className="cc-detail-foot">
                <button className="cc-detail-qr" onClick={() => { setDetails(false); setQr(true) }}>
                  <Icon name="image" size={16} /> باركود التحضير
                </button>
              </div>
            )}
            {showExcuse && studentId && !decided && !isOptional && (
              <div className="cc-detail-foot">
                <ExcuseButton studentId={studentId} sessionId={s.id} sessionTitle={sessName} sessionDate={sessionDate} />
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="cc-detail-row">
      <span className="cc-detail-ic"><Icon name={icon} size={16} /></span>
      <div className="cc-detail-text"><span className="cc-detail-lbl">{label}</span><span className="cc-detail-val">{value}</span></div>
    </div>
  )
}

// التوافق مع الاستدعاء القديم
export default function SessionCard({ session, variant = 'list', ...rest }) {
  if (variant === 'feature') return <FeatureCard session={session} {...rest} />
  return <CompactCard session={session} {...rest} />
}
