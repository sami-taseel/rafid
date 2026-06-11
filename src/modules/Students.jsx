import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import StudentDetail from './StudentDetail'
import { useConfirm, usePrompt } from '../Confirm'
import { useToast } from '../Toast'
import BulkEval from './BulkEval'

export function Spinner() { return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div> }
export function Stat({ num, label }) { return <div className="stat-card"><div className="num">{num}</div><div className="label">{label}</div></div> }

export default function Students() {
  const confirmDialog = useConfirm()
  const promptDialog = usePrompt()
  const toast = useToast()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fNat, setFNat] = useState('')
  const [fDeg, setFDeg] = useState('')
  const [fFile, setFFile] = useState('')
  const [sel, setSel] = useState(null)

  const [catMap, setCatMap] = useState({})   // student_id -> [أسماء الفئات]
  const [allCats, setAllCats] = useState([])
  const [fCat, setFCat] = useState('')
  const [selected, setSelected] = useState([])
  const [bulkCat, setBulkCat] = useState('')
  const [noticeTemplates, setNoticeTemplates] = useState([])
  const [bulkNotice, setBulkNotice] = useState('')
  const [showBulkEval, setShowBulkEval] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: st } = await supabase.from('students')
        .select('id, degree_level, profile_reviewed, persons(full_name, nationality, residency_no, phone)')
      setStudents(st || [])
      // نحمّل الفئات وأعضاءها
      const { data: cats } = await supabase.from('categories').select('id, name').eq('member_type', 'student')
      setAllCats(cats || [])
      const map = {}
      for (const cat of (cats || [])) {
        const { data: mem } = await supabase.rpc('category_students', { p_category: cat.id })
        for (const m of (mem || [])) {
          if (!map[m.student_id]) map[m.student_id] = []
          map[m.student_id].push(cat.name)
        }
      }
      setCatMap(map)
      setLoading(false)
    }
    load()
  }, [])

  async function purgeLegacy() {
    const ok = await confirmDialog({
      title: 'حذف بيانات الطلاب القدامى',
      message: 'سيتم حذف سجلات الطلاب المستوردين قديماً (غير المسجّلين بحساب). الحسابات المسجّلة وأسئلة النموذج تبقى. هل أنت متأكد؟',
      confirmText: 'نعم، ابدأ نظيفاً', danger: true
    })
    if (!ok) return
    const { data } = await supabase.rpc('purge_legacy_students')
    toast(data || 'تم'); setTimeout(() => window.location.reload(), 1200)
  }

  useEffect(() => {
    supabase.from('form_templates').select('id, title').eq('category', 'notice').eq('is_active', true).then(({ data }) => setNoticeTemplates(data || []))
  }, [])

  async function bulkAssign() {
    if (!bulkCat) return
    const rows = selected.map(sid => ({ category_id: bulkCat, student_id: sid }))
    await supabase.from('category_members').upsert(rows, { onConflict: 'category_id,student_id' })
    toast('تم إسناد ' + selected.length + ' طالب للفئة'); setSelected([]); setBulkCat('')
  }
  async function bulkNotify() {
    const text = await promptDialog({ title: 'إرسال إشعار', message: 'نص الإشعار الذي سيصل الطلاب المحدّدين:', placeholder: 'اكتب نص الإشعار…', multiline: true, confirmText: 'إرسال' })
    if (!text) return
    const rows = selected.map(sid => ({ student_id: sid, title: 'إشعار', body: text, kind: 'info' }))
    await supabase.from('notifications').insert(rows)
    toast('تم إرسال الإشعار لـ ' + selected.length + ' طالب'); setSelected([])
  }
  async function bulkIssueNotice() {
    if (!bulkNotice) { toast('اختر نوع الإشعار', 'error'); return }
    const detail = await promptDialog({ title: 'تفاصيل الإشعار', message: 'تفاصيل/سبب الإشعار (يصل الطلاب المحدّدين):', placeholder: 'التفاصيل…', multiline: true, confirmText: 'إصدار' })
    if (detail === null) return
    const tpl = noticeTemplates.find(t => t.id === bulkNotice)
    const { data: au } = await supabase.auth.getUser()
    let pid = null
    if (au?.user) { const { data: p } = await supabase.from('persons').select('id').eq('auth_user_id', au.user.id).maybeSingle(); pid = p?.id }
    const recs = selected.map(sid => ({ template_id: bulkNotice, student_id: sid, status: 'submitted', issued_by: pid, note: detail }))
    await supabase.from('form_records').insert(recs)
    const notifs = selected.map(sid => ({ student_id: sid, title: tpl?.title || 'إشعار إداري', body: detail || tpl?.title, kind: 'violation' }))
    await supabase.from('notifications').insert(notifs)
    toast('تم إصدار «' + (tpl?.title || '') + '» لـ ' + selected.length + ' طالب'); setSelected([]); setBulkNotice('')
  }

  async function bulkExport() {
    const XLSX = await import('xlsx')
    const rows = students.filter(s => selected.includes(s.id)).map(s => ({
      'الاسم': s.persons?.full_name || '', 'الجنسية': s.persons?.nationality || '',
      'المرحلة': s.degree_level || '', 'الإقامة': s.persons?.residency_no || '', 'الجوال': s.persons?.phone || '',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'الطلاب المحدّدون')
    XLSX.writeFile(wb, 'طلاب_محددون.xlsx')
  }

  async function exportAll(rows, filename) {
    const XLSX = await import('xlsx')
    const data = rows.map(s => ({
      'الاسم': s.persons?.full_name || '', 'الجنسية': s.persons?.nationality || '',
      'المرحلة': s.degree_level || '', 'الإقامة': s.persons?.residency_no || '',
      'الجوال': s.persons?.phone || '', 'حالة القبول': s.admission_status || '',
      'الملف مكتمل': s.profile_reviewed ? 'نعم' : 'لا',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [{}]), 'الطلاب')
    XLSX.writeFile(wb, filename)
  }

  if (loading) return <Spinner />
  if (sel) return <StudentDetail studentId={sel} onBack={() => setSel(null)} />

  const nats = [...new Set(students.map(s => s.persons?.nationality).filter(Boolean))]
  const degs = [...new Set(students.map(s => s.degree_level).filter(Boolean))]

  const filtered = students.filter(s => {
    const matchQ = !q || (s.persons?.full_name || '').includes(q) || (s.persons?.residency_no || '').includes(q)
    const matchN = !fNat || s.persons?.nationality === fNat
    const matchD = !fDeg || s.degree_level === fDeg
    const matchF = !fFile || (fFile === 'done' ? s.profile_reviewed : !s.profile_reviewed)
    const matchC = !fCat || (catMap[s.id] || []).includes(fCat)
    return matchQ && matchN && matchD && matchF && matchC
  })

  const byDeg = students.reduce((a, s) => { const d = s.degree_level || 'غير محدد'; a[d] = (a[d]||0)+1; return a }, {})

  return (
    <div>
      <div className="stats">
        <Stat num={students.length} label="إجمالي الطلاب" />
        <Stat num={nats.length} label="عدد الجنسيات" />
        {Object.entries(byDeg).map(([d, n]) => <Stat key={d} num={n} label={d} />)}
      </div>

      <div className="filter-bar">
        <input className="search" placeholder="🔍 بحث بالاسم أو رقم الإقامة…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="filter-row">
          <select value={fNat} onChange={e => setFNat(e.target.value)}>
            <option value="">كل الجنسيات</option>
            {nats.map(n => <option key={n}>{n}</option>)}
          </select>
          <select value={fDeg} onChange={e => setFDeg(e.target.value)}>
            <option value="">كل المراحل</option>
            {degs.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={fFile} onChange={e => setFFile(e.target.value)}>
            <option value="">حالة الملف</option>
            <option value="done">مكتمل</option>
            <option value="pending">غير مكتمل</option>
          </select>
          <select value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">كل الفئات</option>
            {allCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          {(q || fNat || fDeg || fFile || fCat) && <button className="mini" onClick={() => { setQ(''); setFNat(''); setFDeg(''); setFFile(''); setFCat('') }}>مسح الفلاتر</button>}
        </div>
        <div className="result-count">
          {filtered.length} نتيجة
          <span className="export-btns">
            <button className="mini" onClick={() => exportAll(students, 'تصدير_شامل_الطلاب.xlsx')}>⬇ تصدير شامل</button>
            <button className="mini" onClick={() => exportAll(filtered, 'تصدير_مخصص_الطلاب.xlsx')} disabled={filtered.length === students.length}>⬇ تصدير المفلتر</button>
          </span>
        </div>
      </div>

      <div className="cards-view">
        {filtered.map((s) => (
          <div className="student-card clickable" key={s.id} onClick={() => setSel(s.id)}>
            <div className="card-head">
              <div className="avatar">{(s.persons?.full_name || '؟').trim().charAt(0)}</div>
              <div className="card-name">
                <div className="name">{s.persons?.full_name || '—'}</div>
                <div className="degree">{s.degree_level || '—'}</div>
              </div>
              {s.persons?.nationality && <span className="pill">{s.persons.nationality}</span>}
            </div>
            <div className="card-body">
              <span className="muted">الجوال: {s.persons?.phone || '—'}</span>
              <span className="muted">الإقامة: {s.persons?.residency_no || '—'}</span>
            </div>
          </div>
        ))}
      </div>
      {showBulkEval && (
        <BulkEval
          studentIds={selected}
          studentNames={students.filter(s => selected.includes(s.id)).map(s => s.persons?.full_name || 'طالب')}
          onClose={(done) => { setShowBulkEval(false); if (done) setSelected([]) }}
        />
      )}
      {selected.length > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selected.length} محدّد</span>
          <select value={bulkCat} onChange={e => setBulkCat(e.target.value)}>
            <option value="">إسناد لفئة…</option>
            {allCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="mini" onClick={bulkAssign} disabled={!bulkCat}>إسناد</button>
          <button className="mini" onClick={bulkNotify}>إشعار سريع</button>
          {noticeTemplates.length > 0 && <>
            <select value={bulkNotice} onChange={e => setBulkNotice(e.target.value)}>
              <option value="">إشعار إداري…</option>
              {noticeTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button className="mini" onClick={bulkIssueNotice} disabled={!bulkNotice}>إصدار</button>
          </>}
          <button className="mini" onClick={() => setShowBulkEval(true)}>📊 تقييم جماعي</button>
          <button className="mini" onClick={bulkExport}>تصدير المحدّدين</button>
          <button className="mini" onClick={() => setSelected([])}>إلغاء التحديد</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th style={{ width: 36 }}><input type="checkbox"
              checked={filtered.length > 0 && selected.length === filtered.length}
              onChange={e => setSelected(e.target.checked ? filtered.map(s => s.id) : [])} /></th>
            <th>#</th><th>الاسم</th><th>الجنسية</th><th>المرحلة</th><th>الفئات</th><th>الملف</th>
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className={selected.includes(s.id) ? 'row-selected' : ''}>
                <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(s.id)}
                  onChange={() => setSelected(selected.includes(s.id) ? selected.filter(x => x !== s.id) : [...selected, s.id])} /></td>
                <td className="muted clickable" onClick={() => setSel(s.id)}>{i+1}</td>
                <td className="clickable" onClick={() => setSel(s.id)}>{s.persons?.full_name || '—'}</td>
                <td>{s.persons?.nationality ? <span className="pill">{s.persons.nationality}</span> : '—'}</td>
                <td>{s.degree_level || '—'}</td>
                <td className="cats-cell">
                  {(catMap[s.id] || []).length ? (catMap[s.id].map(cn => <span key={cn} className="cat-tag">{cn}</span>)) : <span className="muted">—</span>}
                </td>
                <td>{s.profile_reviewed ? <span className="pill-on">مكتمل</span> : <span className="pill-off">ناقص</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 18, borderColor: '#f0c0c0' }}>
        <h3 style={{ color: '#a32d2d' }}>منطقة الإجراءات الحسّاسة</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          البدء النظيف: يحذف بيانات الطلاب القدامى المستوردة (غير المسجّلين بحساب)،
          ويطلب من الجميع التسجيل من جديد. الحسابات المسجّلة وأسئلة النموذج لا تُحذف.
        </p>
        <button className="fr-del" onClick={purgeLegacy}>حذف بيانات الطلاب القدامى (بدء نظيف)</button>
      </div>
    </div>
  )
}
