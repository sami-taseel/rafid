import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { usePrompt, useConfirm } from '../Confirm'
import Sortable from 'sortablejs'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// الفترات الزمنية
const PERIODS = [
  ['today', 'اليوم'], ['yesterday', 'أمس'], ['this_week', 'الأسبوع الحالي'], ['last_week', 'الأسبوع الماضي'],
  ['this_month', 'الشهر الحالي'], ['last_month', 'الشهر الماضي'], ['all', 'منذ الإنشاء'], ['custom', 'فترة مخصّصة'],
]

// النطاقات وعناصر كل نطاق
const SCOPES = {
  comprehensive: {
    label: 'شامل', icon: '📊',
    sections: [
      ['overview', 'نظرة عامة'], ['students_summary', 'ملخّص الطلاب'], ['attendance', 'الحضور'],
      ['housing', 'السكن'], ['admissions', 'حالات القبول'], ['tickets', 'البلاغات'],
      ['support', 'الدعم'], ['sanctions', 'الجزاءات'], ['recommendations', 'التوصيات'],
    ],
  },
  supervisors: {
    label: 'المشرفون', icon: '👤',
    sections: [
      ['sup_overview', 'ملخّص المشرفين'], ['ticket_handling', 'معالجة البلاغات'],
      ['ticket_ratings', 'تقييمات البلاغات'], ['violations_logged', 'المخالفات المسجّلة'],
    ],
  },
  activities: {
    label: 'الأنشطة', icon: '📚',
    sections: [
      ['act_summary', 'ملخّص الأنشطة'], ['attendance_trend', 'اتجاه الحضور'],
      ['by_track', 'حسب المسار'], ['sessions_list', 'الجلسات'],
    ],
  },
  students_data: {
    label: 'بيانات الطلاب', icon: '👥',
    sections: [
      ['demographics', 'التوزيع الديموغرافي'], ['by_nationality', 'حسب الجنسية'],
      ['by_degree', 'حسب المرحلة'], ['completion', 'اكتمال الملفات'], ['companions', 'المرافقون'],
    ],
  },
  achievements: {
    label: 'إنجازات الطلاب', icon: '🏆',
    sections: [
      ['top_points', 'أعلى النقاط'], ['eval_scores', 'درجات التقييم'],
      ['attendance_champions', 'أبطال الحضور'], ['points_distribution', 'توزيع النقاط'],
    ],
  },
}

const todayISO = () => new Date().toISOString().slice(0, 10)
function periodRange(period, from, to) {
  const now = new Date(); const d = new Date(now)
  const iso = x => x.toISOString().slice(0, 10)
  switch (period) {
    case 'today': return [iso(now), iso(now)]
    case 'yesterday': { d.setDate(d.getDate() - 1); return [iso(d), iso(d)] }
    case 'this_week': { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); return [iso(s), iso(now)] }
    case 'last_week': { const e = new Date(now); e.setDate(now.getDate() - now.getDay() - 1); const s = new Date(e); s.setDate(e.getDate() - 6); return [iso(s), iso(e)] }
    case 'this_month': return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)]
    case 'last_month': return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))]
    case 'custom': return [from || '2020-01-01', to || iso(now)]
    default: return ['2020-01-01', iso(now)]
  }
}

export default function Reports() {
  const toast = useToast()
  const promptDialog = usePrompt()
  const confirmDialog = useConfirm()

  const [period, setPeriod] = useState('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [scope, setScope] = useState('comprehensive')
  // حالة كل نطاق: ترتيب العناصر + الإظهار
  const [order, setOrder] = useState(SCOPES.comprehensive.sections.map(s => s[0]))
  const [hidden, setHidden] = useState({})
  const [presets, setPresets] = useState({})
  const [report, setReport] = useState(null)   // بيانات التقرير المولّد
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const listRef = useRef(null)
  const reportRef = useRef(null)

  // عند تغيير النطاق، نعيد ضبط الترتيب والإظهار
  useEffect(() => {
    setOrder(SCOPES[scope].sections.map(s => s[0]))
    setHidden({})
  }, [scope])

  // تحميل الإعدادات المحفوظة
  async function loadPresets() {
    const { data } = await supabase.from('report_presets').select('*')
    const map = {}; (data || []).forEach(p => { map[p.slot] = p }); setPresets(map)
  }
  useEffect(() => { loadPresets() }, [])

  // سحب وإفلات لإعادة الترتيب
  useEffect(() => {
    if (!listRef.current) return
    const s = Sortable.create(listRef.current, {
      animation: 180, handle: '.rb-drag', ghostClass: 'rb-ghost',
      onEnd: () => {
        const items = listRef.current.querySelectorAll('.rb-item')
        setOrder(Array.from(items).map(el => el.dataset.key))
      },
    })
    return () => s.destroy()
  }, [scope, order.length])

  function toggleSection(key) { setHidden({ ...hidden, [key]: !hidden[key] }) }

  // حفظ/تطبيق الإعدادات
  function currentConfig() { return { period, customFrom, customTo, scope, order, hidden } }
  async function savePreset(slot) {
    const existing = presets[slot]
    const name = await promptDialog({
      title: existing ? 'تحديث الإعداد' : 'حفظ إعداد', message: existing ? 'سيُستبدل الإعداد الحالي.' : 'اكتب اسماً للإعداد',
      defaultValue: existing?.name || `إعداد ${slot}`,
    })
    if (!name) return
    await supabase.from('report_presets').upsert({ slot, name: name.trim().slice(0, 30), config: currentConfig() }, { onConflict: 'owner,slot' })
    toast('تم حفظ الإعداد'); loadPresets()
  }
  function applyPreset(slot) {
    const p = presets[slot]; if (!p) return
    const c = p.config
    setScope(c.scope); setTimeout(() => { setPeriod(c.period); setCustomFrom(c.customFrom || ''); setCustomTo(c.customTo || ''); setOrder(c.order); setHidden(c.hidden || {}) }, 0)
    toast('تم تطبيق «' + p.name + '»')
  }
  async function deletePreset(slot) {
    const ok = await confirmDialog({ title: 'حذف الإعداد', message: 'سيُحذف الإعداد المحفوظ.', confirmText: 'احذف', danger: true })
    if (!ok) return
    await supabase.from('report_presets').delete().eq('slot', slot); toast('حُذف'); loadPresets()
  }

  // توليد التقرير: نجلب البيانات حسب النطاق والفترة
  async function generate() {
    setGenerating(true)
    const [from, to] = periodRange(period, customFrom, customTo)
    const data = await fetchReportData(scope, from, to)
    setReport({ scope, period, from, to, data, order: order.filter(k => !hidden[k]), generatedAt: new Date() })
    setGenerating(false)
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // تصدير صورة PNG
  async function exportPNG() {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      const link = document.createElement('a')
      link.download = `تقرير_رافد_${todayISO()}.png`
      link.href = canvas.toDataURL('image/png'); link.click()
    } catch { toast('تعذّر التصدير', 'error') }
    setExporting(false)
  }
  // تصدير PDF متعدد الصفحات مع فواصل سليمة
  async function exportPDF() {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight()
      const imgW = pw, imgH = canvas.height * pw / canvas.width
      let left = imgH, pos = 0
      const img = canvas.toDataURL('image/png')
      pdf.addImage(img, 'PNG', 0, pos, imgW, imgH)
      left -= ph
      while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, imgW, imgH); left -= ph }
      pdf.save(`تقرير_رافد_${todayISO()}.pdf`)
    } catch { toast('تعذّر التصدير', 'error') }
    setExporting(false)
  }

  const scopeSections = SCOPES[scope].sections
  const sectionLabel = (k) => (scopeSections.find(s => s[0] === k) || [k, k])[1]

  return (
    <div className="report-builder">
      {/* الفترة الزمنية */}
      <div className="panel">
        <h3 className="rb-h">① الفترة الزمنية</h3>
        <div className="rb-chips">
          {PERIODS.map(([v, l]) => (
            <button key={v} className={'rb-chip' + (period === v ? ' on' : '')} onClick={() => setPeriod(v)}>{l}</button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>من</label><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>إلى</label><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></div>
          </div>
        )}
      </div>

      {/* النطاق */}
      <div className="panel">
        <h3 className="rb-h">② نطاق التقرير</h3>
        <div className="rb-scopes">
          {Object.entries(SCOPES).map(([k, v]) => (
            <button key={k} className={'rb-scope' + (scope === k ? ' on' : '')} onClick={() => setScope(k)}>
              <span className="rb-scope-ic">{v.icon}</span><span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* الإعدادات المحفوظة */}
      <div className="panel">
        <h3 className="rb-h">③ الإعدادات المحفوظة</h3>
        <div className="rb-presets">
          {[1, 2, 3, 4, 5].map(slot => {
            const p = presets[slot]
            return (
              <div key={slot} className={'rb-preset' + (p ? ' has' : '')}>
                <button className="rb-preset-load" onClick={() => p ? applyPreset(slot) : savePreset(slot)} title={p ? 'تطبيق' : 'حفظ الإعدادات الحالية'}>
                  <span className="rb-preset-num">{slot}</span>
                  <span className="rb-preset-name">{p ? p.name : 'فارغ'}</span>
                </button>
                <button className="rb-preset-act" onClick={() => savePreset(slot)} title="حفظ/تحديث">💾</button>
                {p && <button className="rb-preset-act del" onClick={() => deletePreset(slot)} title="حذف">🗑</button>}
              </div>
            )
          })}
        </div>
      </div>

      {/* عناصر التقرير (سحب لإعادة الترتيب + إخفاء) */}
      <div className="panel">
        <h3 className="rb-h">④ عناصر التقرير</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>اسحب لإعادة الترتيب، وألغِ تفعيل ما لا تريده.</p>
        <div className="rb-list" ref={listRef}>
          {order.map((key, i) => (
            <div className={'rb-item' + (hidden[key] ? ' off' : '')} key={key} data-key={key}>
              <span className="rb-drag" title="اسحب">⋮⋮</span>
              <span className="rb-num">{i + 1}</span>
              <label className="rb-check"><input type="checkbox" checked={!hidden[key]} onChange={() => toggleSection(key)} /></label>
              <span className="rb-name">{sectionLabel(key)}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="rb-generate" onClick={generate} disabled={generating}>
        {generating ? 'جارٍ التوليد…' : '📄 إنشاء التقرير'}
      </button>

      {/* التقرير المولّد */}
      {report && (
        <div className="rb-report-wrap">
          <div className="rb-export-bar">
            <button className="mini" onClick={exportPNG} disabled={exporting}>{exporting ? 'جارٍ…' : '🖼 تنزيل صورة'}</button>
            <button className="mini" onClick={exportPDF} disabled={exporting}>{exporting ? 'جارٍ…' : '📄 تنزيل PDF'}</button>
          </div>
          <div className="rb-report" ref={reportRef}>
            <ReportView report={report} sectionLabel={sectionLabel} />
          </div>
        </div>
      )}
    </div>
  )
}

// جلب بيانات التقرير حسب النطاق
async function fetchReportData(scope, from, to) {
  const d = {}
  if (scope === 'comprehensive' || scope === 'students_data' || scope === 'achievements') {
    const { data: students } = await supabase.from('students').select('id, degree_level, profile_reviewed, admission_status, unit_id, persons(nationality, full_name)')
    d.students = students || []
  }
  if (scope === 'comprehensive' || scope === 'activities') {
    const { data: att } = await supabase.from('attendance').select('status, sessions(planned_date)')
    d.attendance = (att || []).filter(a => { const dt = a.sessions?.planned_date; return dt && dt >= from && dt <= to })
    const { data: acts } = await supabase.from('activities').select('id, tracks(name_ar)')
    d.activities = acts || []
  }
  if (scope === 'comprehensive' || scope === 'supervisors') {
    const { data: tickets } = await supabase.from('tickets').select('status_code, priority, created_at')
    d.tickets = (tickets || []).filter(t => { const dt = t.created_at?.slice(0, 10); return dt && dt >= from && dt <= to })
    const { data: viol } = await supabase.from('violations').select('id, created_at')
    d.violations = (viol || []).filter(v => { const dt = v.created_at?.slice(0, 10); return dt && dt >= from && dt <= to })
  }
  if (scope === 'comprehensive') {
    const { data: support } = await supabase.from('support_records').select('id, kind, created_at')
    d.support = (support || []).filter(s => { const dt = s.created_at?.slice(0, 10); return dt && dt >= from && dt <= to })
    const { data: sanctions } = await supabase.from('sanctions').select('id, level, created_at')
    d.sanctions = (sanctions || []).filter(s => { const dt = s.created_at?.slice(0, 10); return dt && dt >= from && dt <= to })
    const { data: buildings } = await supabase.from('buildings').select('id, building_type')
    d.buildings = buildings || []
  }
  if (scope === 'achievements') {
    const { data: points } = await supabase.from('points_log').select('student_id, points')
    d.points = points || []
    const { data: evals } = await supabase.from('evaluations').select('student_id, total_score, max_total')
    d.evals = evals || []
    const { data: att2 } = await supabase.from('attendance').select('student_id, status')
    d.allAttendance = att2 || []
  }
  if (scope === 'students_data') {
    const { data: comps } = await supabase.from('companions').select('id')
    d.companions = comps || []
  }
  return d
}

// عرض التقرير (عمودي، مناسب للجوال)
function ReportView({ report, sectionLabel }) {
  const { scope, from, to, data, order, generatedAt } = report
  const periodText = `${from} — ${to}`
  return (
    <div className="rep">
      {/* الترويسة والمعلومات الرئيسية */}
      <div className="rep-head">
        <img src="/logo.png" alt="رافد" className="rep-logo" />
        <div className="rep-title">تقرير {SCOPES[scope].label}</div>
        <div className="rep-org">جمعية تأصيل التعليمية — منصة رافد</div>
        <div className="rep-period">الفترة: {periodText}</div>
        <div className="rep-date">تاريخ الإصدار: {generatedAt.toLocaleDateString('ar')}</div>
      </div>
      {order.map(key => <ReportSection key={key} sectionKey={key} label={sectionLabel(key)} data={data} scope={scope} />)}
      <div className="rep-foot">وُلّد عبر منصة رافد · {generatedAt.toLocaleString('ar')}</div>
    </div>
  )
}

function Bar({ data, color = '#2e5496', suffix = '', max = null }) {
  const mx = max || Math.max(...data.map(x => x.value), 1)
  return (
    <div className="rep-bars">
      {data.map((x, i) => (
        <div key={i} className="rep-bar-row">
          <span className="rep-bar-lbl">{x.label}</span>
          <div className="rep-bar-track"><div className="rep-bar-fill" style={{ width: (x.value / mx * 100) + '%', background: color }}></div></div>
          <span className="rep-bar-val">{x.value}{suffix}</span>
        </div>
      ))}
    </div>
  )
}

function ReportSection({ sectionKey, label, data, scope }) {
  const S = data.students || [], ATT = data.attendance || [], TK = data.tickets || []
  const present = ATT.filter(a => a.status === 'present').length
  const attRate = ATT.length ? Math.round(present / ATT.length * 100) : 0

  function group(arr, fn) { const m = {}; arr.forEach(x => { const k = fn(x) || 'غير محدّد'; m[k] = (m[k] || 0) + 1 }); return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) }

  const blocks = {
    overview: () => <div className="rep-kpis">
      <RepKpi n={S.length} l="الطلاب" /><RepKpi n={attRate + '%'} l="الحضور" />
      <RepKpi n={TK.filter(t => t.status_code !== 'closed').length} l="بلاغات مفتوحة" />
      <RepKpi n={(data.support || []).length} l="مساعدات" />
    </div>,
    students_summary: () => <div className="rep-kpis">
      <RepKpi n={S.length} l="إجمالي الطلاب" /><RepKpi n={S.filter(s => s.profile_reviewed).length} l="ملفات مكتملة" />
      <RepKpi n={S.filter(s => s.unit_id).length} l="مسكّنون" />
    </div>,
    attendance: () => <div className="rep-kpis"><RepKpi n={attRate + '%'} l="نسبة الحضور" /><RepKpi n={present} l="حضور" /><RepKpi n={ATT.length - present} l="غياب" /></div>,
    attendance_trend: () => <Bar data={Object.entries((ATT).reduce((m, a) => { const mo = a.sessions?.planned_date?.slice(0, 7); if (mo) { m[mo] = m[mo] || { p: 0, t: 0 }; m[mo].t++; if (a.status === 'present') m[mo].p++ } return m }, {})).map(([k, v]) => ({ label: k.slice(5) + '/' + k.slice(2, 4), value: v.t ? Math.round(v.p / v.t * 100) : 0 }))} suffix="%" max={100} />,
    housing: () => <div className="rep-kpis"><RepKpi n={S.filter(s => s.unit_id).length} l="مسكّنون" /><RepKpi n={(data.buildings || []).length} l="عمارات" /><RepKpi n={(data.buildings || []).filter(b => b.building_type === 'families').length} l="عمائر عوائل" /></div>,
    admissions: () => <Bar data={group(S, s => ({ active: 'نشط', pending: 'قيد المراجعة', interview: 'مقابلة', accepted: 'مقبول', rejected: 'مرفوض', frozen: 'مجمّد' }[s.admission_status] || 'نشط'))} color="#6b3fc0" />,
    tickets: () => <div className="rep-kpis"><RepKpi n={TK.length} l="إجمالي البلاغات" /><RepKpi n={TK.filter(t => t.status_code === 'resolved' || t.status_code === 'closed').length} l="مُعالجة" /><RepKpi n={TK.filter(t => t.priority === 'urgent' || t.priority === 'critical').length} l="عاجلة" /></div>,
    support: () => <Bar data={group(data.support || [], s => s.kind || 'دعم')} color="#1d9e75" />,
    sanctions: () => <div className="rep-kpis"><RepKpi n={(data.sanctions || []).length} l="الجزاءات" /><RepKpi n={(data.sanctions || []).filter(s => s.level === 'eviction').length} l="إخلاءات" /></div>,
    recommendations: () => {
      const recs = []
      if (attRate < 70) recs.push('نسبة الحضور منخفضة — يُنصح بمتابعة الطلاب المتغيّبين.')
      if (TK.filter(t => t.status_code !== 'closed').length > 5) recs.push('تراكم بلاغات مفتوحة — يُنصح بتسريع المعالجة.')
      if (S.filter(s => !s.profile_reviewed).length > 0) recs.push(`${S.filter(s => !s.profile_reviewed).length} طالب لم يكمل ملفه — يُنصح بالتذكير.`)
      if (!recs.length) recs.push('المؤشرات ضمن المعدّل الجيد. أحسنتم!')
      return <ul className="rep-recs">{recs.map((r, i) => <li key={i}>{r}</li>)}</ul>
    },
    // المشرفون
    sup_overview: () => <div className="rep-kpis"><RepKpi n={TK.length} l="بلاغات الفترة" /><RepKpi n={(data.violations || []).length} l="مخالفات مسجّلة" /></div>,
    ticket_handling: () => <div className="rep-kpis"><RepKpi n={TK.filter(t => t.status_code === 'resolved').length} l="مُعالجة" /><RepKpi n={TK.filter(t => t.status_code === 'in_progress').length} l="جارية" /><RepKpi n={TK.filter(t => t.status_code === 'open').length} l="مفتوحة" /></div>,
    ticket_ratings: () => <div className="rep-note">تقييمات البلاغات للفترة المحدّدة.</div>,
    violations_logged: () => <div className="rep-kpis"><RepKpi n={(data.violations || []).length} l="مخالفات الفترة" /></div>,
    // الأنشطة
    act_summary: () => <div className="rep-kpis"><RepKpi n={(data.activities || []).length} l="الأنشطة" /><RepKpi n={ATT.length} l="سجلات حضور" /><RepKpi n={attRate + '%'} l="نسبة الحضور" /></div>,
    by_track: () => <Bar data={group(data.activities || [], a => a.tracks?.name_ar)} color="#157080" />,
    sessions_list: () => <div className="rep-note">عدد الجلسات في الفترة: {ATT.length} سجل حضور.</div>,
    // بيانات الطلاب
    demographics: () => <div className="rep-kpis"><RepKpi n={S.length} l="الطلاب" /><RepKpi n={group(S, s => s.persons?.nationality).length} l="جنسيات" /><RepKpi n={(data.companions || []).length} l="مرافقون" /></div>,
    by_nationality: () => <Bar data={group(S, s => s.persons?.nationality).slice(0, 8)} color="#6b3fc0" />,
    by_degree: () => <Bar data={group(S, s => s.degree_level)} color="#1d9e75" />,
    completion: () => <div className="rep-kpis"><RepKpi n={S.length ? Math.round(S.filter(s => s.profile_reviewed).length / S.length * 100) + '%' : '0%'} l="نسبة الاكتمال" /><RepKpi n={S.filter(s => !s.profile_reviewed).length} l="ملفات ناقصة" /></div>,
    companions: () => <div className="rep-kpis"><RepKpi n={(data.companions || []).length} l="إجمالي المرافقين" /></div>,
    // الإنجازات
    top_points: () => {
      const byStudent = {}; (data.points || []).forEach(p => { byStudent[p.student_id] = (byStudent[p.student_id] || 0) + p.points })
      const names = {}; (data.students || []).forEach(s => { names[s.id] = s.persons?.full_name })
      const top = Object.entries(byStudent).map(([id, v]) => ({ label: names[id] || 'طالب', value: v })).sort((a, b) => b.value - a.value).slice(0, 8)
      return top.length ? <Bar data={top} color="#e0a800" /> : <div className="rep-note">لا نقاط بعد.</div>
    },
    eval_scores: () => {
      const EV = data.evals || []
      const avg = EV.length ? Math.round(EV.reduce((s, e) => s + (e.max_total ? e.total_score / e.max_total * 100 : 0), 0) / EV.length) : 0
      return <div className="rep-kpis"><RepKpi n={avg + '%'} l="متوسط التقييم" /><RepKpi n={EV.length} l="عدد التقييمات" /></div>
    },
    attendance_champions: () => {
      const byS = {}; (data.allAttendance || []).forEach(a => { byS[a.student_id] = byS[a.student_id] || { p: 0, t: 0 }; byS[a.student_id].t++; if (a.status === 'present') byS[a.student_id].p++ })
      const names = {}; (data.students || []).forEach(s => { names[s.id] = s.persons?.full_name })
      const champs = Object.entries(byS).map(([id, v]) => ({ label: names[id] || 'طالب', value: v.t ? Math.round(v.p / v.t * 100) : 0 })).sort((a, b) => b.value - a.value).slice(0, 5)
      return champs.length ? <Bar data={champs} suffix="%" max={100} color="#1d9e75" /> : <div className="rep-note">لا بيانات.</div>
    },
    points_distribution: () => {
      const total = (data.points || []).reduce((s, p) => s + p.points, 0)
      return <div className="rep-kpis"><RepKpi n={total} l="مجموع النقاط" /><RepKpi n={new Set((data.points || []).map(p => p.student_id)).size} l="طلاب حاصلون" /></div>
    },
  }
  const render = blocks[sectionKey]
  return (
    <div className="rep-section">
      <div className="rep-section-title">{label}</div>
      {render ? render() : <div className="rep-note">—</div>}
    </div>
  )
}

function RepKpi({ n, l }) { return <div className="rep-kpi"><div className="rep-kpi-n">{n}</div><div className="rep-kpi-l">{l}</div></div> }

