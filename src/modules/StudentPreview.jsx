import { useEffect, Component } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import StudentProfile from '../StudentProfile'

// حدّ خطأ: يمنع انهيار صفحة المدير إن فشل عرض جزء
class PreviewBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div className="spv-err">
          <Icon name="alert" size={26} />
          <div style={{ marginTop: 8, fontWeight: 700 }}>تعذّر عرض الصفحة</div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: .8 }}>{String(this.state.err?.message || '')}</div>
        </div>
      )
    }
    return this.props.children
  }
}

// حساب الطالب كما يراه بالضبط — بلا أي تعديل، معطّل التفاعل
export default function StudentPreview({ studentId, studentName, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div className="spv-overlay" onClick={onClose}>
      <div className="spv-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="spv-bar">
          <button className="spv-x" onClick={onClose} aria-label="إغلاق"><Icon name="x" size={17} /></button>
          <span className="spv-bar-t">
            <Icon name="eye" size={14} /> حساب: {studentName || 'طالب'}
          </span>
          <span className="spv-bar-note">عرض فقط — لا يمكن تنفيذ أي إجراء</span>
        </div>

        {/* حساب الطالب كما هو، مع درع يمنع التفاعل */}
        <div className="spv-frame spv-noaction">
          <PreviewBoundary>
            <StudentProfile viewStudentId={studentId} viewOnly session={{ user: { id: null, email: null } }} />
          </PreviewBoundary>
        </div>
      </div>
    </div>,
    document.body
  )
}
