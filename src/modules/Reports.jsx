import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

const REPORTS = [
  { key: 'students', label: 'بيانات الطلاب', icon: '👥' },
  { key: 'attendance', label: 'سجل الحضور', icon: '✓' },
  { key: 'sanctions', label: 'الجزاءات', icon: '⚠️' },
  { key: 'support', label: 'الدعم المُقدّم', icon: '🎁' },
]

export default function Reports() {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

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
