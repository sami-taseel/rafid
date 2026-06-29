import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import { formatTime } from '../dateUtils'
import ExcuseButton from './ExcuseButton'

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
export function FeatureCard({ session, studentId, sessionDate, attStatus }) {
  const s = session
  const { act, sessName, actTitle, meta } = sessInfo(s)
  const decided = attDecided(attStatus)
  return (
    <div className="fc-card" style={{ '--sc-color': meta.color }}>
      <div className="fc-top">
        <span className="fc-type" style={{ background: meta.color, color: '#fff' }}>
          <Icon name={meta.icon} size={13} /> {act.activity_type || 'نشاط'}
        </span>
        {act.tracks?.name_ar && <span className="fc-track">{act.tracks.name_ar}</span>}
        {decided
          ? <span className="fc-att-slot"><AttBadge status={attStatus} /></span>
          : s.start_time && <span className="fc-time"><Icon name="clock" size={13} /> {formatTime(s.start_time)}{s.duration_min ? ` · ${s.duration_min}د` : ''}</span>}
      </div>
      <h4 className="fc-title">{sessName}</h4>
      {actTitle && <div className="fc-subtitle">{actTitle}</div>}
      <div className="fc-info-grid">
        {act.provider && <div className="fc-info"><Icon name="user" size={15} /><div><span className="fc-info-lbl">مقدّم الجلسة</span><span className="fc-info-val">{act.provider}</span></div></div>}
        {act.location && <div className="fc-info"><Icon name="pin" size={15} /><div><span className="fc-info-lbl">المكان</span><span className="fc-info-val">{act.location}</span></div></div>}
      </div>
      {/* زر الإذن يظهر فقط إن لم تُحسم الحالة بعد */}
      {studentId && !decided && (
        <div className="fc-action">
          <ExcuseButton studentId={studentId} sessionId={s.id} sessionTitle={sessName} sessionDate={sessionDate} />
        </div>
      )}
    </div>
  )
}

// ============ البطاقة المختصرة (بطاقتان بالصف) ============
export function CompactCard({ session, studentId, sessionDate, showExcuse = true, attStatus }) {
  const s = session
  const { act, sessName, actTitle, meta } = sessInfo(s)
  const [details, setDetails] = useState(false)
  const date = s.planned_date ? new Date(s.planned_date + 'T00:00:00') : null
  const decided = attDecided(attStatus)

  return (
    <>
      <div className={'cc-card' + (decided ? ' cc-decided cc-' + attStatus : '')} style={{ '--sc-color': meta.color }}>
        <div className="cc-stripe"></div>
        <div className="cc-body">
          <div className="cc-head">
            <span className="cc-type" style={{ background: meta.color + '18', color: meta.color }}>
              <Icon name={meta.icon} size={11} /> {act.activity_type || 'نشاط'}
            </span>
            {decided ? <AttBadge status={attStatus} size="mini" /> : (date && <span className="cc-date">{date.getDate()} {MON[date.getMonth()]}</span>)}
          </div>
          <h4 className="cc-title">{sessName}</h4>
          {actTitle && <div className="cc-subtitle">{actTitle}</div>}
          <div className="cc-foot">
            {s.start_time && <span className="cc-time"><Icon name="clock" size={13} /> {formatTime(s.start_time)}</span>}
            <div className="cc-actions">
              <button className="cc-icon-btn" onClick={() => setDetails(true)} title="التفاصيل" aria-label="التفاصيل">
                <Icon name="eye" size={15} />
              </button>
              {/* زر الإذن يظهر فقط إن لم تُحسم الحالة */}
              {showExcuse && studentId && !decided && (
                <ExcuseButton studentId={studentId} sessionId={s.id} sessionTitle={sessName} sessionDate={sessionDate} compact />
              )}
            </div>
          </div>
        </div>
      </div>

      {details && createPortal(
        <div className="cc-detail-overlay" onClick={() => setDetails(false)}>
          <div className="cc-detail-card" onClick={e => e.stopPropagation()}>
            <div className="cc-detail-hero" style={{ background: meta.color }}>
              <button className="cc-detail-close" onClick={() => setDetails(false)} aria-label="إغلاق"><Icon name="x" size={18} /></button>
              <span className="cc-detail-type"><Icon name={meta.icon} size={14} /> {act.activity_type || 'نشاط'}</span>
              <h3 className="cc-detail-title">{sessName}</h3>
              {actTitle && <p className="cc-detail-sub">{actTitle}</p>}
            </div>
            <div className="cc-detail-body">
              {decided && <div className="cc-detail-att"><AttBadge status={attStatus} /></div>}
              {date && <DetailRow icon="calendar" label="التاريخ" value={`${date.getDate()} ${MON[date.getMonth()]} ${date.getFullYear()}`} />}
              {s.start_time && <DetailRow icon="clock" label="الوقت" value={`${formatTime(s.start_time)}${s.duration_min ? ` · ${s.duration_min} دقيقة` : ''}`} />}
              {act.provider && <DetailRow icon="user" label="مقدّم الجلسة" value={act.provider} />}
              {act.location && <DetailRow icon="pin" label="المكان" value={act.location} />}
              {act.tracks?.name_ar && <DetailRow icon="tag" label="المسار" value={act.tracks.name_ar} />}
            </div>
            {showExcuse && studentId && !decided && (
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
