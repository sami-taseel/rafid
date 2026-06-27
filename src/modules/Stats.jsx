import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Stats({ onNavigate }) {
  const [d, setD] = useState(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: au } = await supabase.auth.getUser()
      if (au?.user) {
        const { data: p } = await supabase.from('persons').select('full_name').eq('auth_user_id', au.user.id).maybeSingle()
        if (p?.full_name) setUserName(p.full_name.split(' ')[0])
      }
      const [students, sessions, activities, attendance, sanctions, support, responses,
             surveys, tickets, categories, buildings, units, risk, attTimed, travelers,
             admissions, evals, points, formRecs, formTpls] = await Promise.all([
        supabase.from('students').select('id, degree_level, profile_reviewed, admission_status, unit_id, persons(nationality)'),
        supabase.from('sessions').select('id, status, planned_date, activities(track_id, tracks(name_ar))'),
        supabase.from('activities').select('id, tracks(name_ar)'),
        supabase.from('attendance').select('status'),
        supabase.from('sanctions').select('level, status'),
        supabase.from('support_records').select('id, kind'),
        supabase.from('survey_responses').select('id'),
        supabase.from('surveys').select('id, is_active'),
        supabase.from('tickets').select('status_code, priority, created_at, ticket_types(name)'),
        supabase.from('categories').select('id'),
        supabase.from('buildings').select('id, building_type'),
        supabase.from('units').select('id, building_id'),
        supabase.rpc('students_at_risk'),
        supabase.from('attendance').select('status, sessions(planned_date)'),
        supabase.rpc('travelers_count'),
        supabase.from('students').select('admission_status'),
        supabase.from('evaluations').select('total_score, max_total'),
        supabase.from('points_log').select('points'),
        supabase.from('form_records').select('status, form_templates(category)'),
        supabase.from('form_templates').select('id, category, required, is_active'),
      ])

      const S = students.data || [], SES = sessions.data || [], ATT = attendance.data || []
      const SAN = sanctions.data || [], TK = tickets.data || []

      // توزيع الجنسيات
      const natMap = {}
      S.forEach(s => { const n = s.persons?.nationality || 'غير محدّد'; natMap[n] = (natMap[n]||0)+1 })
      const byNat = Object.entries(natMap).map(([k,v])=>({label:k,value:v})).sort((a,b)=>b.value-a.value).slice(0,6)

      // توزيع المراحل
      const degMap = {}
      S.forEach(s => { const dg = s.degree_level || 'غير محدّد'; degMap[dg] = (degMap[dg]||0)+1 })
      const byDeg = Object.entries(degMap).map(([k,v])=>({label:k,value:v}))

      // الأنشطة بالمسار
      const trackMap = {}
      ;(activities.data||[]).forEach(a => { const t = a.tracks?.name_ar || 'غير محدّد'; trackMap[t] = (trackMap[t]||0)+1 })
      const byTrack = Object.entries(trackMap).map(([k,v])=>({label:k,value:v})).sort((a,b)=>b.value-a.value)

      // البلاغات بالحالة
      const tkStatus = { open:0, in_progress:0, resolved:0, failed:0, closed:0 }
      TK.forEach(t => { tkStatus[t.status_code] = (tkStatus[t.status_code]||0)+1 })
      const openTickets = TK.filter(t => t.status_code !== 'closed').length

      // اتجاه الحضور الشهري
      const monthly = {}
      ;(attTimed.data||[]).forEach(a => {
        const dt = a.sessions?.planned_date; if (!dt) return
        const m = dt.slice(0,7)
        if (!monthly[m]) monthly[m] = { p:0, t:0 }
        monthly[m].t++; if (a.status==='present') monthly[m].p++
      })
      const trend = Object.keys(monthly).sort().slice(-6).map(m=>({month:m.slice(5)+'/'+m.slice(2,4), rate: monthly[m].t? Math.round(monthly[m].p/monthly[m].t*100):0}))

      const present = ATT.filter(a=>a.status==='present').length
      const absentCount = ATT.filter(a=>a.status==='absent').length
      const excusedCount = ATT.filter(a=>a.status==='excused').length
      const attTotal = present + absentCount + excusedCount
      const attRate = attTotal ? Math.round(present/attTotal*100) : 0
      const absentRate = attTotal ? Math.round(absentCount/attTotal*100) : 0
      const excusedRate = attTotal ? Math.round(excusedCount/attTotal*100) : 0

      // تنبيهات استباقية
      const openByType = {}
      TK.forEach(t => { if (t.status_code!=='closed'){ const n=t.ticket_types?.name||'عام'; openByType[n]=(openByType[n]||0)+1 } })
      const proactive = []
      Object.entries(openByType).forEach(([n,c])=>{ if(c>=3) proactive.push(`تراكم ${c} بلاغات «${n}» مفتوحة`) })
      const urgentTickets = TK.filter(t => t.status_code!=='closed' && (t.priority==='urgent'||t.priority==='critical')).length
      if (urgentTickets>0) proactive.unshift(`${urgentTickets} بلاغ عاجل/طارئ بانتظار المعالجة`)

      // مهام تحتاج انتباه
      const pendingEvict = SAN.filter(s=>s.level==='eviction' && s.status==='pending').length
      const incomplete = S.filter(s=>!s.profile_reviewed).length
      const today = new Date().toISOString().slice(0,10)
      const todaySessions = SES.filter(s=>s.planned_date===today).length

      // توزيع حالات القبول
      const admMap = {}
      ;(admissions.data||[]).forEach(a => { const k = a.admission_status || 'active'; admMap[k] = (admMap[k]||0)+1 })

      // متوسط درجات التقييم
      const EV = evals.data || []
      const avgEval = EV.length ? Math.round(EV.reduce((s,e)=> s + (e.max_total ? (e.total_score/e.max_total*100) : 0), 0) / EV.length) : 0

      // مجموع النقاط الممنوحة
      const totalPoints = (points.data||[]).reduce((s,p)=> s + (p.points||0), 0)

      // إشغال السكن: عدد الطلاب المسكّنين مقابل عدد الشقق
      const housedStudents = S.filter(s=>s.unit_id).length
      const totalUnits = (units.data||[]).length
      const familyBuildings = (buildings.data||[]).filter(b=>b.building_type==='families').length
      const singleBuildings = (buildings.data||[]).filter(b=>b.building_type==='singles').length

      // الموافقات: موقّعة مقابل معلّقة
      const FR = formRecs.data || []
      const approvedForms = FR.filter(r=>r.form_templates?.category==='approval' && r.status==='approved').length
      const pendingForms = FR.filter(r=>r.form_templates?.category==='approval' && r.status==='pending').length
      const requestForms = FR.filter(r=>r.form_templates?.category==='request').length

      setD({
        students: S.length, sessions: SES.length, activities: (activities.data||[]).length,
        attRate, present, absentCount, excusedCount, attTotal, absentRate, excusedRate,
        sanctions: SAN.length, support: (support.data||[]).length,
        responses: (responses.data||[]).length, surveys: (surveys.data||[]).length,
        activeSurveys: (surveys.data||[]).filter(x=>x.is_active).length,
        categories: (categories.data||[]).length, buildings: (buildings.data||[]).length,
        units: (units.data||[]).length, openTickets, tkStatus,
        byNat, byDeg, byTrack, trend, proactive,
        risk: risk.data || [], pendingEvict, incomplete, todaySessions,
        completeRate: S.length ? Math.round(S.filter(s=>s.profile_reviewed).length/S.length*100) : 0,
        travelers: travelers.data ?? 0,
        admMap, avgEval, totalPoints, housedStudents, totalUnits, familyBuildings, singleBuildings,
        approvedForms, pendingForms, requestForms,
      })
    }
    load()
  }, [])

  if (!d) return <div className="state"><div className="spinner"></div>جارٍ تحميل لوحة المعلومات…</div>

  const greg = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  let hijri = ''
  try { hijri = new Date().toLocaleDateString('ar-SA-u-ca-islamic', { day:'numeric', month:'long', year:'numeric' }) } catch {}
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء الخير'

  const tasks = []
  if (d.pendingEvict>0) tasks.push({icon:'🚨',text:`${d.pendingEvict} إخلاء معلّق يحتاج مراجعتك`,type:'urgent',go:'housing'})
  if (d.openTickets>0) tasks.push({icon:'📨',text:`${d.openTickets} بلاغ قيد المتابعة`,type:'warn',go:'tickets'})
  if (d.risk.length>0) tasks.push({icon:'⚠️',text:`${d.risk.length} طالب معرّض للخطر`,type:'urgent',go:null})
  if (d.incomplete>0) tasks.push({icon:'📝',text:`${d.incomplete} طالب لم يكمل بياناته`,type:'warn',go:'students'})
  if (d.todaySessions>0) tasks.push({icon:'📅',text:`${d.todaySessions} جلسة مجدولة اليوم`,type:'info',go:'activities'})

  const actions = [
    {label:'الطلاب',icon:'👥',go:'students'},
    {label:'رصد الحضور',icon:'✓',go:'activities'},
    {label:'البلاغات',icon:'📨',go:'tickets'},
    {label:'إنشاء استبانة',icon:'📋',go:'surveys'},
  ]

  return (
    <div className="dash">
      {/* ترحيب */}
      <div className="dash-hero">
        <div>
          <h2 className="dash-greeting">{greeting}{userName && '، ' + userName} 👋</h2>
          <p className="dash-date">{greg}{hijri && ' · ' + hijri + ' هـ'}</p>
        </div>
        <div className="dash-quick">
          {actions.map(a => (
            <button key={a.go} className="dash-action" onClick={()=>onNavigate&&onNavigate(a.go)}>
              <span className="da-icon">{a.icon}</span><span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* تنبيهات استباقية */}
      {d.proactive.length>0 && (
        <div className="dash-proactive">
          {d.proactive.map((p,i)=><div key={i} className="dash-alert">🔔 {p}</div>)}
        </div>
      )}

      {/* مهام تحتاج انتباهك */}
      {tasks.length>0 && (
        <div className="panel">
          <h3 className="dash-sec">يحتاج انتباهك</h3>
          <div className="task-list">
            {tasks.map((t,i)=>(
              <div key={i} className={'task-item '+t.type+(t.go?' clickable':'')} onClick={()=>t.go&&onNavigate&&onNavigate(t.go)}>
                <span className="task-icon">{t.icon}</span><span>{t.text}</span>
                {t.go && <span className="task-arrow">←</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* مؤشرات رئيسية */}
      <div className="kpi-grid">
        <Kpi num={d.students} label="الطلاب" icon="👥" color="blue" onClick={()=>onNavigate&&onNavigate('students')} />
        <Kpi num={d.attRate+'%'} label="نسبة الحضور" icon="✓" color="green" />
        <Kpi num={d.openTickets} label="بلاغات مفتوحة" icon="📨" color="red" onClick={()=>onNavigate&&onNavigate('tickets')} />
        <Kpi num={d.activities} label="الأنشطة" icon="📚" color="purple" onClick={()=>onNavigate&&onNavigate('activities')} />
        <Kpi num={d.completeRate+'%'} label="اكتمال الملفات" icon="📋" color="teal" />
        <Kpi num={d.support} label="مساعدات" icon="🎁" color="amber" />
      </div>

      {/* إحصاءات الحضور التفصيلية */}
      <div className="att-stats-section">
        <h3 className="dash-sec">إحصاءات الحضور</h3>
        <div className="att-stats-grid">
          <div className="att-stat att-stat-present">
            <div className="att-stat-ic">✓</div>
            <div className="att-stat-body">
              <div className="att-stat-num">{d.present}</div>
              <div className="att-stat-lbl">حاضر</div>
            </div>
            <div className="att-stat-pct">{d.attRate}%</div>
          </div>
          <div className="att-stat att-stat-excused">
            <div className="att-stat-ic">⊘</div>
            <div className="att-stat-body">
              <div className="att-stat-num">{d.excusedCount}</div>
              <div className="att-stat-lbl">مستأذن</div>
            </div>
            <div className="att-stat-pct">{d.excusedRate}%</div>
          </div>
          <div className="att-stat att-stat-absent">
            <div className="att-stat-ic">✕</div>
            <div className="att-stat-body">
              <div className="att-stat-num">{d.absentCount}</div>
              <div className="att-stat-lbl">غائب</div>
            </div>
            <div className="att-stat-pct">{d.absentRate}%</div>
          </div>
          <div className="att-stat att-stat-total">
            <div className="att-stat-ic">Σ</div>
            <div className="att-stat-body">
              <div className="att-stat-num">{d.attTotal}</div>
              <div className="att-stat-lbl">إجمالي الرصد</div>
            </div>
          </div>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="dash-charts">
        {d.trend.length>1 && (
          <div className="panel chart-panel">
            <h3 className="dash-sec">اتجاه الحضور (آخر ٦ أشهر)</h3>
            <BarChart data={d.trend.map(t=>({label:t.month,value:t.rate}))} suffix="%" color="#2e5496" max={100} />
          </div>
        )}
        <div className="panel chart-panel">
          <h3 className="dash-sec">البلاغات حسب الحالة</h3>
          <Donut segments={[
            {label:'مفتوح',value:d.tkStatus.open,color:'#2e5496'},
            {label:'جاري',value:d.tkStatus.in_progress,color:'#f5a623'},
            {label:'مُعالج',value:d.tkStatus.resolved,color:'#1d9e75'},
            {label:'متعذّر',value:d.tkStatus.failed,color:'#c0392b'},
            {label:'مغلق',value:d.tkStatus.closed,color:'#9aa3b2'},
          ]} />
        </div>
        <div className="panel chart-panel">
          <h3 className="dash-sec">الطلاب حسب الجنسية</h3>
          <BarChart data={d.byNat} color="#6b3fc0" />
        </div>
        <div className="panel chart-panel">
          <h3 className="dash-sec">الطلاب حسب المرحلة</h3>
          <BarChart data={d.byDeg} color="#1d9e75" />
        </div>
        {d.byTrack.length>0 && (
          <div className="panel chart-panel">
            <h3 className="dash-sec">الأنشطة حسب المسار</h3>
            <BarChart data={d.byTrack} color="#157080" />
          </div>
        )}

        <div className="panel chart-panel">
          <h3 className="dash-sec">حالات القبول</h3>
          <Donut segments={[
            {label:'نشط',value:d.admMap.active||0,color:'#1d9e75'},
            {label:'قيد المراجعة',value:d.admMap.pending||0,color:'#f5a623'},
            {label:'مقابلة',value:d.admMap.interview||0,color:'#2e5496'},
            {label:'مقبول',value:d.admMap.accepted||0,color:'#1d7a52'},
            {label:'مرفوض',value:d.admMap.rejected||0,color:'#c0392b'},
            {label:'مجمّد',value:d.admMap.frozen||0,color:'#9aa3b2'},
          ]} unit="طالب" />
        </div>

        <div className="panel chart-panel">
          <h3 className="dash-sec">الموافقات والنماذج</h3>
          <BarChart data={[
            {label:'موافقات موقّعة',value:d.approvedForms},
            {label:'بانتظار التوقيع',value:d.pendingForms},
            {label:'طلبات مقدّمة',value:d.requestForms},
          ]} color="#6b3fc0" />
        </div>

        <div className="panel chart-panel">
          <h3 className="dash-sec">السكن والإشغال</h3>
          <div className="mini-stats">
            <MiniStat label="طلاب مسكّنون" value={d.housedStudents} />
            <MiniStat label="إجمالي الشقق" value={d.totalUnits} />
            <MiniStat label="عمائر عوائل" value={d.familyBuildings} />
            <MiniStat label="عمائر عزّاب" value={d.singleBuildings} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="bar-row">
              <span className="bar-label">نسبة التسكين</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: (d.students ? Math.round(d.housedStudents/d.students*100) : 0) + '%', background: '#2e5496' }}></div></div>
              <span className="bar-val">{d.students ? Math.round(d.housedStudents/d.students*100) : 0}%</span>
            </div>
          </div>
        </div>

        <div className="panel chart-panel">
          <h3 className="dash-sec">التقييم والتحفيز</h3>
          <div className="mini-stats">
            <MiniStat label="متوسط التقييم" value={d.avgEval + '%'} />
            <MiniStat label="مجموع النقاط الممنوحة" value={d.totalPoints} />
          </div>
        </div>

        <div className="panel chart-panel">
          <h3 className="dash-sec">نظرة عامة</h3>
          <div className="mini-stats">
            <MiniStat label="الفئات" value={d.categories} />
            <MiniStat label="العمارات" value={d.buildings} />
            <MiniStat label="الوحدات السكنية" value={d.units} />
            <MiniStat label="الجلسات" value={d.sessions} />
            <MiniStat label="استبانات نشطة" value={d.activeSurveys} />
            <MiniStat label="ردود الاستبانات" value={d.responses} />
            <MiniStat label="الجزاءات" value={d.sanctions} />
            <MiniStat label="طلاب معرّضون" value={d.risk.length} warn={d.risk.length>0} />
            <MiniStat label="مسافرون حالياً" value={d.travelers} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ num, label, icon, color, onClick }) {
  return (
    <div className={'kpi kpi-'+color+(onClick?' clickable':'')} onClick={onClick}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-data"><div className="kpi-n">{num}</div><div className="kpi-l">{label}</div></div>
    </div>
  )
}

function MiniStat({ label, value, warn }) {
  return <div className="mini-stat"><span className={'mini-n'+(warn?' warn':'')}>{value}</span><span className="mini-l">{label}</span></div>
}

// رسم أعمدة أفقي بسيط
function BarChart({ data, color='#2e5496', suffix='', max=null }) {
  const mx = max || Math.max(...data.map(d=>d.value), 1)
  return (
    <div className="bars">
      {data.map((d,i)=>(
        <div key={i} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{width:(d.value/mx*100)+'%',background:color}}></div></div>
          <span className="bar-val">{d.value}{suffix}</span>
        </div>
      ))}
    </div>
  )
}

// رسم حلقي (donut) عبر conic-gradient
function Donut({ segments, unit = 'بلاغ' }) {
  const total = segments.reduce((s,x)=>s+x.value,0)
  if (total===0) return <div className="muted" style={{textAlign:'center',padding:20}}>لا بيانات</div>
  let acc = 0
  const stops = segments.filter(s=>s.value>0).map(s=>{
    const start = acc/total*360; acc += s.value; const end = acc/total*360
    return `${s.color} ${start}deg ${end}deg`
  }).join(', ')
  return (
    <div className="donut-wrap">
      <div className="donut" style={{background:`conic-gradient(${stops})`}}>
        <div className="donut-hole"><span className="donut-total">{total}</span><span className="donut-lbl">{unit}</span></div>
      </div>
      <div className="donut-legend">
        {segments.filter(s=>s.value>0).map((s,i)=>(
          <div key={i} className="dl-item"><span className="dl-dot" style={{background:s.color}}></span>{s.label} ({s.value})</div>
        ))}
      </div>
    </div>
  )
}
