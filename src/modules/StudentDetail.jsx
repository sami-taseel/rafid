import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useState as useCertState } from 'react'
import Certificate from './Certificate'

export default function StudentDetail({ studentId, onBack }) {
  const [d, setD] = useState(null)
  const [cert, setCert] = useCertState(false)

  useEffect(() => {
    async function load() {
      const [s, comp, att, sanc, supp, docs, vals] = await Promise.all([
        supabase.from('students').select('*, persons(*)').eq('id', studentId).single(),
        supabase.from('companions').select('relation, persons(full_name, residency_no)').eq('student_id', studentId),
        supabase.from('attendance').select('status').eq('student_id', studentId),
        supabase.from('sanctions').select('*').eq('student_id', studentId),
        supabase.from('support_records').select('*').eq('student_id', studentId),
        supabase.from('documents').select('*').eq('student_id', studentId),
        supabase.from('student_field_values').select('value, profile_fields(label)').eq('student_id', studentId),
      ])
      setD({ s: s.data, comp: comp.data || [], att: att.data || [], sanc: sanc.data || [],
             supp: supp.data || [], docs: docs.data || [], vals: vals.data || [] })
    }
    load()
  }, [studentId])

  if (!d) return <Spinner />
  const present = d.att.filter(a => a.status === 'present').length
  const absent = d.att.filter(a => a.status === 'absent').length
  const p = d.s?.persons

  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع للقائمة</button>
      <div className="detail-hero">
        <div className="avatar lg">{(p?.full_name || '؟').charAt(0)}</div>
        <div>
          <h2>{p?.full_name || '—'}</h2>
          <span className="muted">{d.s?.degree_level} · {p?.nationality}</span>
        </div>
        <button className="mini" style={{ marginRight: 'auto' }} onClick={() => setCert(true)}>إصدار شهادة</button>
      </div>
      {cert && <Certificate name={p?.full_name} activity="أنشطة مشروع طلاب المنح" date={new Date().toLocaleDateString('ar')} onClose={() => setCert(false)} />}

      <div className="stats">
        <div className="stat-card"><div className="num">{present}</div><div className="label">حضور</div></div>
        <div className="stat-card"><div className="num">{absent}</div><div className="label">غياب</div></div>
        <div className="stat-card"><div className="num">{d.sanc.length}</div><div className="label">جزاءات</div></div>
        <div className="stat-card"><div className="num">{d.supp.length}</div><div className="label">دعم</div></div>
      </div>

      <div className="panel">
        <h3>البيانات الأساسية</h3>
        <div className="detail-grid">
          <Info label="الجوال" val={p?.phone} />
          <Info label="رقم الإقامة" val={p?.residency_no} />
          <Info label="الجنسية" val={p?.nationality} />
          <Info label="البريد" val={p?.email} />
        </div>
      </div>

      {d.vals.length > 0 && (
        <div className="panel">
          <h3>بيانات النموذج</h3>
          <div className="detail-grid">
            {d.vals.map((v, i) => <Info key={i} label={v.profile_fields?.label} val={v.value} />)}
          </div>
        </div>
      )}

      <div className="panel">
        <h3>المرافقون ({d.comp.length})</h3>
        {d.comp.map((c, i) => <div key={i} className="list-line">👤 {c.persons?.full_name} <span className="pill">{c.relation}</span></div>)}
        {d.comp.length === 0 && <div className="muted">لا يوجد</div>}
      </div>

      <div className="panel">
        <h3>المستندات ({d.docs.length})</h3>
        {d.docs.map(doc => <div key={doc.id} className="list-line">📎 {doc.doc_type}</div>)}
        {d.docs.length === 0 && <div className="muted">لا توجد مستندات مرفوعة</div>}
      </div>

      {d.sanc.length > 0 && (
        <div className="panel">
          <h3>الجزاءات</h3>
          {d.sanc.map(s => <div key={s.id} className="list-line">⚠️ {sanctionLabel(s.level)} — {s.cited_article}</div>)}
        </div>
      )}
    </div>
  )
}
function Info({ label, val }) {
  return <div className="info-item"><span className="info-label">{label}</span><span className="info-val">{val || '—'}</span></div>
}
function sanctionLabel(l) { return { notice: 'لفت نظر', warning: 'إنذار كتابي', eviction: 'إخلاء سكن' }[l] || l }
