import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

// مصادر التقرير المخصّص: لكل مصدر أعمدته الممكنة
const SOURCES = {
  students: {
    label: 'الطلاب',
    cols: { full_name: 'الاسم', nationality: 'الجنسية', degree_level: 'المرحلة', residency_no: 'رقم الإقامة', phone: 'الجوال', email: 'البريد', university: 'الجامعة', college: 'الكلية', major: 'التخصص' },
  },
  attendance: {
    label: 'الحضور',
    cols: { student: 'الطالب', activity: 'النشاط', session: 'الجلسة', date: 'التاريخ', status: 'الحالة' },
  },
  tickets: {
    label: 'البلاغات',
    cols: { title: 'العنوان', student: 'الطالب', type: 'النوع', status: 'الحالة', priority: 'الأولوية', created: 'تاريخ الإنشاء' },
  },
}

const REPORTS = [
  { key: 'students', label: 'بيانات الطلاب', icon: '👥' },
  { key: 'attendance', label: 'سجل الحضور', icon: '✓' },
  { key: 'sanctions', label: 'الجزاءات', icon: '⚠️' },
  { key: 'support', label: 'الدعم المُقدّم', icon: '🎁' },
]

export default function Reports() {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [cSource, setCSource] = useState('students')
  const [cCols, setCCols] = useState([])
  const [cFrom, setCFrom] = useState('')
  const [cTo, setCTo] = useState('')

  async function exportReport(type) {
    setBusy(type); setMsg(null)
    let rows = []
    if (type === 'students') {
      const { data } = await supabase.from('students').select('degree_level, persons(full_name, nationality, residency_no, phone, email)')
      rows = (data || []).map(s => ({
        'الاسم': s.persons?.full_name, 'الجنسية': s.persons?.nationality, 'المرحلة': s.degree_level,
        'رقم الإقامة': s.persons?.residency_no, 'الجوال': s.persons?.phone, 'البريد': s.persons?.email,
      }))
    } else if (type === 'attendance') {
      const { data } = await supabase.from('attendance').select('status, students(persons(full_name)), sessions(planned_date, activities(title))')
      const lbl = { present: 'حاضر', absent: 'غائب', excused: 'مستأذن', not_recorded: 'غير مرصود' }
      rows = (data || []).map(a => ({
        'الطالب': a.students?.persons?.full_name, 'النشاط': a.sessions?.activities?.title,
        'التاريخ': a.sessions?.planned_date, 'الحالة': lbl[a.status] || a.status,
      }))
    } else if (type === 'sanctions') {
      const { data } = await supabase.from('sanctions').select('level, status, cited_article, created_at, students(persons(full_name))')
      const lv = { notice: 'لفت نظر', warning: 'إنذار', eviction: 'إخلاء' }
      rows = (data || []).map(s => ({
        'الطالب': s.students?.persons?.full_name, 'الدرجة': lv[s.level], 'السبب': s.cited_article,
        'الحالة': s.status, 'التاريخ': new Date(s.created_at).toLocaleDateString('ar'),
      }))
    } else if (type === 'support') {
      const { data } = await supabase.from('support_records').select('kind, description, source, received_at, students(persons(full_name))')
      rows = (data || []).map(r => ({
        'الطالب': r.students?.persons?.full_name, 'النوع': r.kind === 'cash' ? 'نقدي' : 'عيني',
        'الوصف': r.description, 'المصدر': r.source, 'التاريخ': r.received_at,
      }))
    }
    if (!rows.length) { setMsg('لا توجد بيانات في هذا التقرير'); setBusy(null); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير')
    XLSX.writeFile(wb, `تقرير_${REPORTS.find(r => r.key === type).label}.xlsx`)
    setBusy(null)
  }

  async function fetchRows(type) {
    let rows = []
    if (type === 'students') {
      const { data } = await supabase.from('students').select('degree_level, persons(full_name, nationality, residency_no, phone, email)')
      rows = (data || []).map(s => ({ 'الاسم': s.persons?.full_name, 'الجنسية': s.persons?.nationality, 'المرحلة': s.degree_level, 'رقم الإقامة': s.persons?.residency_no, 'الجوال': s.persons?.phone, 'البريد': s.persons?.email }))
    } else if (type === 'attendance') {
      const { data } = await supabase.from('attendance').select('status, students(persons(full_name)), sessions(planned_date, activities(title))')
      const lbl = { present: 'حاضر', absent: 'غائب', excused: 'مستأذن', not_recorded: 'غير مرصود' }
      rows = (data || []).map(a => ({ 'الطالب': a.students?.persons?.full_name, 'النشاط': a.sessions?.activities?.title, 'التاريخ': a.sessions?.planned_date, 'الحالة': lbl[a.status] || a.status }))
    } else if (type === 'sanctions') {
      const { data } = await supabase.from('sanctions').select('level, status, cited_article, created_at, students(persons(full_name))')
      const lv = { notice: 'لفت نظر', warning: 'إنذار', eviction: 'إخلاء' }
      rows = (data || []).map(s => ({ 'الطالب': s.students?.persons?.full_name, 'الدرجة': lv[s.level], 'السبب': s.cited_article, 'الحالة': s.status, 'التاريخ': new Date(s.created_at).toLocaleDateString('ar') }))
    } else if (type === 'support') {
      const { data } = await supabase.from('support_records').select('kind, description, source, received_at, students(persons(full_name))')
      rows = (data || []).map(r => ({ 'الطالب': r.students?.persons?.full_name, 'النوع': r.kind === 'cash' ? 'نقدي' : 'عيني', 'الوصف': r.description, 'المصدر': r.source, 'التاريخ': r.received_at }))
    }
    return rows
  }

  function toggleCol(key) { setCCols(cCols.includes(key) ? cCols.filter(c => c !== key) : [...cCols, key]) }

  async function exportCustom() {
    if (cCols.length === 0) { setMsg('اختر عموداً واحداً على الأقل'); return }
    setBusy('custom'); setMsg(null)
    let rows = []
    if (cSource === 'students') {
      const { data } = await supabase.from('students').select('degree_level, university, college, major, persons(full_name, nationality, residency_no, phone, email)')
      rows = (data || []).map(s => {
        const src = { full_name: s.persons?.full_name, nationality: s.persons?.nationality, degree_level: s.degree_level, residency_no: s.persons?.residency_no, phone: s.persons?.phone, email: s.persons?.email, university: s.university, college: s.college, major: s.major }
        const r = {}; cCols.forEach(k => r[SOURCES.students.cols[k]] = src[k] || ''); return r
      })
    } else if (cSource === 'attendance') {
      let q = supabase.from('attendance').select('status, students(persons(full_name)), sessions(planned_date, title, activities(title))')
      const { data } = await q
      const lbl = { present: 'حاضر', absent: 'غائب', excused: 'مستأذن', not_recorded: 'غير مرصود' }
      rows = (data || []).filter(a => {
        const d = a.sessions?.planned_date; if (cFrom && d < cFrom) return false; if (cTo && d > cTo) return false; return true
      }).map(a => {
        const src = { student: a.students?.persons?.full_name, activity: a.sessions?.activities?.title, session: a.sessions?.title, date: a.sessions?.planned_date, status: lbl[a.status] || a.status }
        const r = {}; cCols.forEach(k => r[SOURCES.attendance.cols[k]] = src[k] || ''); return r
      })
    } else if (cSource === 'tickets') {
      const { data } = await supabase.from('tickets').select('title, status_code, priority, created_at, ticket_types(name), students(persons(full_name))')
      const pr = { normal: 'عادي', urgent: 'عاجل', critical: 'طارئ' }
      rows = (data || []).filter(t => {
        const d = t.created_at?.slice(0,10); if (cFrom && d < cFrom) return false; if (cTo && d > cTo) return false; return true
      }).map(t => {
        const src = { title: t.title, student: t.students?.persons?.full_name, type: t.ticket_types?.name, status: t.status_code, priority: pr[t.priority] || t.priority, created: t.created_at?.slice(0,10) }
        const r = {}; cCols.forEach(k => r[SOURCES.tickets.cols[k]] = src[k] || ''); return r
      })
    }
    if (!rows.length) { setMsg('لا توجد بيانات مطابقة'); setBusy(null); return }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'تقرير مخصّص')
    XLSX.writeFile(wb, 'تقرير_مخصص.xlsx')
    setBusy(null); setMsg('تم تصدير التقرير المخصّص')
  }

  async function exportAll() {
    setBusy('all'); setMsg(null)
    const wb = XLSX.utils.book_new()
    for (const r of REPORTS) {
      const rows = await fetchRows(r.key)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), r.label.slice(0, 28))
    }
    XLSX.writeFile(wb, 'تصدير_شامل_رافد.xlsx')
    setBusy(null); setMsg('تم التصدير الشامل بنجاح')
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>تقرير مخصّص</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>ابنِ تقريرك: اختر المصدر، ثم الأعمدة، ثم الفترة (اختيارية)، ثم صدّر.</p>
        <div className="field"><label>المصدر</label>
          <select value={cSource} onChange={e => { setCSource(e.target.value); setCCols([]) }}>
            {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field"><label>الأعمدة</label>
          <div className="col-pick">
            {Object.entries(SOURCES[cSource].cols).map(([k, lbl]) => (
              <button type="button" key={k} className={'col-chip' + (cCols.includes(k) ? ' on' : '')} onClick={() => toggleCol(k)}>{lbl}</button>
            ))}
          </div>
        </div>
        {cSource !== 'students' && (
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}><label>من تاريخ</label><input type="date" value={cFrom} onChange={e => setCFrom(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>إلى تاريخ</label><input type="date" value={cTo} onChange={e => setCTo(e.target.value)} /></div>
          </div>
        )}
        <button className="save-btn" style={{ width: 'auto', padding: '12px 24px' }} onClick={exportCustom} disabled={busy === 'custom'}>
          {busy === 'custom' ? 'جارٍ…' : '⬇ تصدير التقرير المخصّص'}
        </button>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>التصدير الشامل</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>تصدير كل بيانات المنصة (الطلاب، الحضور، الجزاءات، الدعم) في ملف Excel واحد متعدّد الأوراق، للأرشفة والتقارير الرسمية.</p>
        <button className="save-btn" style={{ width: 'auto', padding: '12px 24px' }} onClick={exportAll} disabled={busy === 'all'}>
          {busy === 'all' ? 'جارٍ التجهيز…' : '⬇ تصدير شامل (Excel)'}
        </button>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>أو اختر تقريراً محدّداً لتصديره:</p>
      <div className="report-grid">
        {REPORTS.map(r => (
          <button key={r.key} className="report-card" onClick={() => exportReport(r.key)} disabled={busy === r.key}>
            <div className="report-icon">{r.icon}</div>
            <div className="report-label">{r.label}</div>
            <div className="report-action">{busy === r.key ? 'جارٍ…' : '⬇ تصدير Excel'}</div>
          </button>
        ))}
      </div>
      {msg && <div className="save-ok" style={{ marginTop: 16 }}>{msg}</div>}
    </div>
  )
}
