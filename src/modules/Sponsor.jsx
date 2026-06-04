import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

// لوحة راعي المشروع: ملخص تنفيذي بصري عالي المستوى
export default function Sponsor() {
  const [d, setD] = useState(null)
  useEffect(() => {
    async function load() {
      const [students, att, support, sanctions, responses, tracks] = await Promise.all([
        supabase.from('students').select('id, profile_reviewed'),
        supabase.from('attendance').select('status'),
        supabase.from('support_records').select('id'),
        supabase.from('sanctions').select('id'),
        supabase.from('survey_responses').select('id'),
        supabase.from('tracks').select('id'),
      ])
      const present = (att.data||[]).filter(a=>a.status==='present').length
      const absent = (att.data||[]).filter(a=>a.status==='absent').length
      setD({
        students: (students.data||[]).length,
        completed: (students.data||[]).filter(s=>s.profile_reviewed).length,
        attRate: (present+absent)?Math.round(present/(present+absent)*100):0,
        support: (support.data||[]).length,
        responses: (responses.data||[]).length,
        tracks: (tracks.data||[]).length,
      })
    }
    load()
  }, [])
  if (!d) return <Spinner />
  const completionPct = d.students ? Math.round(d.completed/d.students*100) : 0
  return (
    <div>
      <div className="sponsor-hero">
        <h2>الملخص التنفيذي</h2>
        <p>نظرة عامة على أداء مشروع طلاب المنح الدوليين</p>
      </div>
      <div className="kpi-grid">
        <Kpi big={d.students} label="طالب مستفيد" sub={`${d.tracks} مسارات تنموية`} />
        <Kpi big={completionPct + '%'} label="اكتمال ملفات الطلاب" sub={`${d.completed} من ${d.students}`} />
        <Kpi big={d.attRate + '%'} label="معدل الحضور العام" sub="في الأنشطة" />
        <Kpi big={d.support} label="حالة دعم مقدّمة" sub="عينية ونقدية" />
        <Kpi big={d.responses} label="رد على الاستبانات" sub="قياس الرضا" />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <p className="muted" style={{ lineHeight: 2 }}>
          يخدم المشروع {d.students} طالباً دولياً عبر {d.tracks} مسارات تنموية متكاملة،
          بمعدل حضور {d.attRate}% في الأنشطة، وقد قُدّمت {d.support} حالة دعم للطلاب.
        </p>
      </div>
    </div>
  )
}
function Kpi({ big, label, sub }) {
  return <div className="kpi-card"><div className="kpi-num">{big}</div><div className="kpi-label">{label}</div><div className="kpi-sub">{sub}</div></div>
}
