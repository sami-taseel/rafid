import Icon from '../Icon'
import { formatTime } from '../dateUtils'

// أيقونة ولون حسب نوع النشاط
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

// بطاقة جلسة موحّدة تعرض كل العناصر — تُستخدم في كل صفحات الطالب
// variant: 'feature' (أقرب موعد، بارزة) | 'list' (المواعيد القادمة) | 'compact' (التقويم)
export default function SessionCard({ session, variant = 'list', showDate = true, footer = null }) {
  const s = session
  const act = s.activities || {}
  const sessName = s.title || act.title || 'جلسة'
  const actTitle = act.title && act.title !== sessName ? act.title : null
  const meta = typeMeta(act.activity_type)
  const date = s.planned_date ? new Date(s.planned_date + 'T00:00:00') : null
  const dayNum = date ? date.getDate() : ''
  const monName = date ? MON[date.getMonth()] : ''

  return (
    <div className={`sc-card sc-${variant}`} style={{ '--sc-color': meta.color }}>
      {/* الشريط الجانبي الملوّن */}
      <div className="sc-stripe"></div>

      <div className="sc-main">
        {/* الترويسة: التاريخ + النوع */}
        <div className="sc-head">
          {showDate && date && (
            <div className="sc-date">
              <span className="sc-date-num">{dayNum}</span>
              <span className="sc-date-mon">{monName}</span>
            </div>
          )}
          <div className="sc-head-text">
            <div className="sc-type-row">
              <span className="sc-type-badge" style={{ background: meta.color + '18', color: meta.color }}>
                <Icon name={meta.icon} size={12} /> {act.activity_type || 'نشاط'}
              </span>
              {act.tracks?.name_ar && <span className="sc-track">{act.tracks.name_ar}</span>}
            </div>
            <h4 className="sc-title">{sessName}</h4>
            {actTitle && <div className="sc-subtitle">{actTitle}</div>}
          </div>
        </div>

        {/* تفاصيل الجلسة */}
        <div className="sc-details">
          {s.start_time && (
            <span className="sc-detail"><Icon name="clock" size={14} /> {formatTime(s.start_time)}{s.duration_min ? ` · ${s.duration_min} د` : ''}</span>
          )}
          {act.provider && (
            <span className="sc-detail"><Icon name="user" size={14} /> {act.provider}</span>
          )}
          {act.location && (
            <span className="sc-detail"><Icon name="pin" size={14} /> {act.location}</span>
          )}
        </div>

        {footer && <div className="sc-footer">{footer}</div>}
      </div>
    </div>
  )
}
