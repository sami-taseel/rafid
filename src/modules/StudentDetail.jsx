import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import StudentEval, { statusLabel } from './StudentEval'
import { Spinner } from './Students'
import { useState as useCertState } from 'react'
import Certificate from './Certificate'
import Attachment from './Attachment'

export default function StudentDetail({ studentId, onBack }) {
  const toast = useToast()
  const [d, setD] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [detailTab, setDetailTab] = useState('info')
  const [cert, setCert] = useCertState(false)

  useEffect(() => {
    async function load() {
      const [s, comp, att, sanc, supp, docs, vals] = await Promise.all([
        supabase.from('students').select('*, persons(*)').eq('id', studentId).single(),
        supabase.rpc('my_companions', { p_student: studentId }),
        supabase.from('attendance').select('status').eq('student_id', studentId),
        supabase.from('sanctions').select('*').eq('student_id', studentId),
        supabase.from('support_records').select('*').eq('student_id', studentId),
        supabase.from('student_attachments').select('*, attachment_types(name), companions(relation, persons(full_name))').eq('student_id', studentId),
        supabase.from('student_field_values').select('value, profile_fields(label)').eq('student_id', studentId),
      ])
      setD({ s: s.data, comp: comp.data || [], att: att.data || [], sanc: sanc.data || [],
             supp: supp.data || [], docs: docs.data || [], vals: vals.data || [] })
    }
    load()
  }, [studentId])

  useEffect(() => { supabase.rpc('active_buildings').then(({ data }) => setBuildings(data || [])) }, [])

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
          {d.s?.admission_status && d.s.admission_status !== 'active' && <span className={'adm-badge adm-' + d.s.admission_status}>{statusLabel(d.s.admission_status)}</span>}
        </div>
        <button className="mini" style={{ marginRight: 'auto' }} onClick={() => setCert(true)}>إصدار شهادة</button>
      </div>

      <div className="detail-tabs">
        <button className={detailTab === 'info' ? 'on' : ''} onClick={() => setDetailTab('info')}>المعلومات</button>
        <button className={detailTab === 'eval' ? 'on' : ''} onClick={() => setDetailTab('eval')}>التقييم والقبول</button>
      </div>
      {cert && <Certificate name={p?.full_name} activity="أنشطة مشروع طلاب المنح" date={new Date().toLocaleDateString('ar')} onClose={() => setCert(false)} />}

      {detailTab === 'eval' && <StudentEval studentId={studentId} currentStatus={d.s?.admission_status} onStatusChange={s => setD({ ...d, s: { ...d.s, admission_status: s } })} />}

      {detailTab === 'info' && <>
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
        <HousingAssign d={d} setD={setD} studentId={studentId} buildings={buildings} toast={toast} />
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
        {d.comp.map((c, i) => (
          <div key={i} className="detail-comp-row">
            <span>👤 <strong>{c.full_name || 'مرافق'}</strong> <span className="pill">{c.relation}</span></span>
            <span className="muted" style={{ fontSize: 12 }}>
              {c.age != null && `${c.age} سنة`}{c.residency_no && ` · إقامة ${c.residency_no}`}{c.education_level && ` · ${c.education_level}`}
            </span>
          </div>
        ))}
        {d.comp.length === 0 && <div className="muted">لا يوجد</div>}
      </div>

      <div className="panel">
        <h3>المستندات ({d.docs.length})</h3>
        {d.docs.map(doc => (
          <div key={doc.id} className="detail-doc-row">
            <span>📄 {doc.attachment_types?.name || 'مستند'}
              {doc.companions && <span className="muted"> · {doc.companions.persons?.full_name || doc.companions.relation}</span>}
              {doc.term_label && <span className="muted"> · {doc.term_label}</span>}
            </span>
            <Attachment path={doc.file_path} label="عرض" />
          </div>
        ))}
        {d.docs.length === 0 && <div className="muted">لا توجد مستندات مرفوعة</div>}
      </div>

      {d.sanc.length > 0 && (
        <div className="panel">
          <h3>الجزاءات</h3>
          {d.sanc.map(s => <div key={s.id} className="list-line">⚠️ {sanctionLabel(s.level)} — {s.cited_article}</div>)}
        </div>
      )}
      </>}
    </div>
  )
}
function HousingAssign({ d, setD, studentId, buildings, toast }) {
  const [units, setUnits] = useState([])
  const buildingId = d.s?.housing_building_id || ''

  useEffect(() => {
    if (buildingId) supabase.rpc('building_units', { p_building: buildingId }).then(({ data }) => setUnits(data || []))
    else setUnits([])
  }, [buildingId])

  async function pickBuilding(bid) {
    await supabase.from('students').update({ housing_building_id: bid || null, unit_id: null }).eq('id', studentId)
    setD({ ...d, s: { ...d.s, housing_building_id: bid || null, unit_id: null } })
    toast('تم تحديث العمارة')
  }
  async function pickUnit(uid) {
    const { data } = await supabase.rpc('assign_unit', { p_student: studentId, p_unit: uid || null })
    toast(data || 'تم')
    if (data && data.includes('بنجاح')) setD({ ...d, s: { ...d.s, unit_id: uid } })
    else if (!uid) setD({ ...d, s: { ...d.s, unit_id: null } })
    // إعادة تحميل عدد الساكنين
    if (buildingId) supabase.rpc('building_units', { p_building: buildingId }).then(({ data }) => setUnits(data || []))
  }

  const bType = buildings.find(b => b.id === buildingId)?.building_type

  return (
    <div style={{ marginTop: 14 }}>
      <div className="form-row">
        <div className="field" style={{ flex: 1 }}>
          <label>العمارة</label>
          <select value={buildingId} onChange={e => pickBuilding(e.target.value)}>
            <option value="">غير محدّد</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name} ({b.building_type === 'families' ? 'عوائل' : 'عزّاب'})</option>)}
          </select>
        </div>
        {buildingId && (
          <div className="field" style={{ flex: 1 }}>
            <label>الشقة {bType === 'families' ? '(طالب واحد)' : '(عدة طلاب)'}</label>
            <select value={d.s?.unit_id || ''} onChange={e => pickUnit(e.target.value)}>
              <option value="">غير محدّدة</option>
              {units.map(u => <option key={u.id} value={u.id}>شقة {u.unit_no} · {u.rooms} غرفة · {u.occupants} ساكن</option>)}
            </select>
          </div>
        )}
      </div>
      {buildingId && units.length === 0 && <p className="muted" style={{ fontSize: 13 }}>لا شقق معرّفة في هذه العمارة. أضفها من «العمارات والوحدات».</p>}
    </div>
  )
}

function Info({ label, val }) {
  return <div className="info-item"><span className="info-label">{label}</span><span className="info-val">{val || '—'}</span></div>
}
function sanctionLabel(l) { return { notice: 'لفت نظر', warning: 'إنذار كتابي', eviction: 'إخلاء سكن' }[l] || l }
