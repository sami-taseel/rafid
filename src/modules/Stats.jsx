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
             surveys, tickets, categories, buildings, units, risk, attTimed] = await Promise.all([
        supabase.from('students').select('id, degree_level, profile_reviewed, persons(nationality)'),
        supabase.from('sessions').select('id, status, planned_date, activities(track_id, tracks(name_ar))'),
        supabase.from('activities').select('id, tracks(name_ar)'),
        supabase.from('attendance').select('status'),
        supabase.from('sanctions').select('level, status'),
        supabase.from('support_records').select('id, kind'),
        supabase.from('survey_responses').select('id'),
        supabase.from('surveys').select('id, is_active'),
        supabase.from('tickets').select('status_code, priority, created_at, ticket_types(name)'),
        supabase.from('categories').select('id'),
        supabase.from('buildings').select('id'),
        supabase.from('units').select('id'),
        supabase.rpc('students_at_risk'),
        supabase.from('attendance').select('status, sessions(planned_date)'),
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
      const attRate = ATT.length ? Math.round(present/ATT.length*100) : 0

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

      setD({
        students: S.length, sessions: SES.length, activities: (activities.data||[]).length,
        attRate, sanctions: SAN.length, support: (support.data||[]).length,
        responses: (responses.data||[]).length, surveys: (surveys.data||[]).length,
        activeSurveys: (surveys.data||[]).filter(x=>x.is_active).length,
        categories: (categories.data||[]).length, buildings: (buildings.data||[]).length,
        units: (units.data||[]).length, openTickets, tkStatus,
        byNat, byDeg, byTrack, trend, proactive,
        risk: risk.data || [], pendingEvict, incomplete, todaySessions,
        completeRate: S.length ? Math.round(S.filter(s=>s.profile_reviewed).length/S.length*100) : 0,
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
function Donut({ segments }) {
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
        <div className="donut-hole"><span className="donut-total">{total}</span><span className="donut-lbl">بلاغ</span></div>
      </div>
      <div className="donut-legend">
        {segments.filter(s=>s.value>0).map((s,i)=>(
          <div key={i} className="dl-item"><span className="dl-dot" style={{background:s.color}}></span>{s.label} ({s.value})</div>
        ))}
      </div>
    </div>
  )
}
