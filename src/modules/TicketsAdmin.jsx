import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useConfirm } from '../Confirm'
import { useToast } from '../Toast'

const ROLES = [
  ['housing_supervisor','مشرف السكن'], ['edu_supervisor','المشرف التعليمي'],
  ['social_supervisor','المشرف الاجتماعي'], ['care_supervisor','مشرف الرعاية'],
  ['follow_supervisor','مشرف المتابعة'], ['', 'بلا (المدير فقط)'],
]
const Q_TYPES = [['stars','نجوم'],['likert','مقياس رضا'],['yesno','نعم/لا'],['text','نص']]

export default function TicketsAdmin() {
  const [tab, setTab] = useState('types')
  return (
    <div>
      <div className="login-tabs" style={{ maxWidth: 480, marginBottom: 18 }}>
        <button className={tab==='types'?'active':''} onClick={()=>setTab('types')}>أنواع البلاغات</button>
        <button className={tab==='statuses'?'active':''} onClick={()=>setTab('statuses')}>الحالات</button>
        <button className={tab==='survey'?'active':''} onClick={()=>setTab('survey')}>استبيان الإغلاق</button>
        <button className={tab==='notif'?'active':''} onClick={()=>setTab('notif')}>صياغة الإشعار</button>
      </div>
      {tab === 'types' && <TypesManager />}
      {tab === 'statuses' && <StatusesManager />}
      {tab === 'survey' && <SurveyManager />}
      {tab === 'notif' && <NotifManager />}
    </div>
  )
}

function TypesManager() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true)
  const confirmDialog = useConfirm(); const toast = useToast()
  async function load() { const { data } = await supabase.from('ticket_types').select('*').order('sort_order'); setRows(data||[]); setLoading(false) }
  useEffect(() => { load() }, [])
  async function add() { const max = rows.reduce((m,r)=>Math.max(m,r.sort_order),0); await supabase.from('ticket_types').insert({ name:'نوع جديد', sort_order:max+1 }); load() }
  function patch(id,p){ setRows(rows.map(r=>r.id===id?{...r,...p}:r)) }
  async function save(r){ await supabase.from('ticket_types').update({ name:r.name, handler_role:r.handler_role||null, is_active:r.is_active }).eq('id',r.id); toast('تم الحفظ') }
  async function del(id){ const ok=await confirmDialog({title:'حذف النوع',message:'سيُحذف نوع البلاغ.',confirmText:'احذف',danger:true}); if(!ok)return; await supabase.from('ticket_types').delete().eq('id',id); load() }
  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{marginBottom:12}}>لكل نوع بلاغ مشرف مسؤول يصله البلاغ. التغييرات تُحفظ عند الخروج من الحقل.</p>
      {rows.map(r => (
        <div className="panel" key={r.id}>
          <div className="form-row">
            <input value={r.name} onChange={e=>patch(r.id,{name:e.target.value})} onBlur={()=>save(r)} placeholder="اسم النوع" />
            <select value={r.handler_role||''} onChange={e=>{patch(r.id,{handler_role:e.target.value}); setTimeout(()=>save({...r,handler_role:e.target.value}),0)}}>
              {ROLES.map(([c,l])=><option key={c} value={c}>{l}</option>)}
            </select>
            <label className="chk"><input type="checkbox" checked={r.is_active} onChange={e=>{patch(r.id,{is_active:e.target.checked}); setTimeout(()=>save({...r,is_active:e.target.checked}),0)}} /> ظاهر</label>
            <button className="fr-del" onClick={()=>del(r.id)}>حذف</button>
          </div>
        </div>
      ))}
      <button className="add-field-btn" onClick={add}>+ إضافة نوع</button>
    </div>
  )
}

function StatusesManager() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true)
  const confirmDialog = useConfirm(); const toast = useToast()
  const PROTECTED = ['resolved','failed','closed']  // أساسية لا تُحذف
  async function load() { const { data } = await supabase.from('ticket_statuses').select('*').order('sort_order'); setRows(data||[]); setLoading(false) }
  useEffect(() => { load() }, [])
  async function add() { const max = rows.reduce((m,r)=>Math.max(m,r.sort_order),0); await supabase.from('ticket_statuses').insert({ name:'حالة جديدة', sort_order:max+1 }); load() }
  function patch(id,p){ setRows(rows.map(r=>r.id===id?{...r,...p}:r)) }
  async function save(r){ await supabase.from('ticket_statuses').update({ name:r.name, is_active:r.is_active }).eq('id',r.id); toast('تم الحفظ') }
  async function del(r){ if(PROTECTED.includes(r.code)){toast('حالة أساسية لا تُحذف','error');return} const ok=await confirmDialog({title:'حذف الحالة',message:'ستُحذف الحالة.',confirmText:'احذف',danger:true}); if(!ok)return; await supabase.from('ticket_statuses').delete().eq('id',r.id); load() }
  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{marginBottom:12}}>حالات «تمت المعالجة» و«يتعذّر» تتطلب تأكيد الطالب للإغلاق. الحالات الأساسية محميّة من الحذف.</p>
      {rows.map(r => (
        <div className="panel" key={r.id}>
          <div className="form-row">
            <input value={r.name} onChange={e=>patch(r.id,{name:e.target.value})} onBlur={()=>save(r)} />
            {r.code && <span className="pill">{r.code}</span>}
            {r.is_terminal && <span className="req-badge">يتطلب تأكيد الطالب</span>}
            <label className="chk"><input type="checkbox" checked={r.is_active} onChange={e=>{patch(r.id,{is_active:e.target.checked}); setTimeout(()=>save({...r,is_active:e.target.checked}),0)}} /> ظاهر</label>
            <button className="fr-del" onClick={()=>del(r)}>حذف</button>
          </div>
        </div>
      ))}
      <button className="add-field-btn" onClick={add}>+ إضافة حالة</button>
    </div>
  )
}

function SurveyManager() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true)
  const confirmDialog = useConfirm(); const toast = useToast()
  async function load() { const { data } = await supabase.from('ticket_survey_questions').select('*').order('sort_order'); setRows(data||[]); setLoading(false) }
  useEffect(() => { load() }, [])
  async function add() { const max = rows.reduce((m,r)=>Math.max(m,r.sort_order),0); await supabase.from('ticket_survey_questions').insert({ q_text:'سؤال جديد', q_type:'stars', sort_order:max+1 }); load() }
  function patch(id,p){ setRows(rows.map(r=>r.id===id?{...r,...p}:r)) }
  async function save(r){ await supabase.from('ticket_survey_questions').update({ q_text:r.q_text, q_type:r.q_type, is_active:r.is_active }).eq('id',r.id); toast('تم الحفظ') }
  async function del(id){ const ok=await confirmDialog({title:'حذف السؤال',message:'سيُحذف سؤال الاستبيان.',confirmText:'احذف',danger:true}); if(!ok)return; await supabase.from('ticket_survey_questions').delete().eq('id',id); load() }
  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{marginBottom:12}}>أسئلة يُجيب عنها الطالب عند تأكيد إغلاق البلاغ.</p>
      {rows.map(r => (
        <div className="panel" key={r.id}>
          <input style={{width:'100%',marginBottom:8,padding:10,border:'1px solid var(--border)',borderRadius:8,fontFamily:'inherit'}} value={r.q_text} onChange={e=>patch(r.id,{q_text:e.target.value})} onBlur={()=>save(r)} />
          <div className="form-row">
            <select value={r.q_type} onChange={e=>{patch(r.id,{q_type:e.target.value}); setTimeout(()=>save({...r,q_type:e.target.value}),0)}}>
              {Q_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <label className="chk"><input type="checkbox" checked={r.is_active} onChange={e=>{patch(r.id,{is_active:e.target.checked}); setTimeout(()=>save({...r,is_active:e.target.checked}),0)}} /> ظاهر</label>
            <button className="fr-del" onClick={()=>del(r.id)}>حذف</button>
          </div>
        </div>
      ))}
      <button className="add-field-btn" onClick={add}>+ إضافة سؤال</button>
    </div>
  )
}

function NotifManager() {
  const [tpl, setTpl] = useState(''); const [loading, setLoading] = useState(true)
  const toast = useToast()
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'ticket_notif_template').maybeSingle()
      .then(({ data }) => { setTpl(data?.value || 'تحديث على بلاغك «{title}»: الحالة الآن {status}'); setLoading(false) })
  }, [])
  async function save() {
    await supabase.from('app_settings').upsert({ key: 'ticket_notif_template', value: tpl }, { onConflict: 'key' })
    toast('تم حفظ الصياغة')
  }
  if (loading) return <Spinner />
  return (
    <div className="panel">
      <h3>صياغة إشعار تحديث البلاغ</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        النص الذي يصل الطالب عند تغيّر حالة بلاغه. استخدم <b>{'{title}'}</b> لعنوان البلاغ، و<b>{'{status}'}</b> للحالة الجديدة.
      </p>
      <textarea style={{ width: '100%', minHeight: 90, padding: 12, border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
        value={tpl} onChange={e => setTpl(e.target.value)} onBlur={save} />
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>مثال الناتج: تحديث على بلاغك «تسرب ماء»: الحالة الآن تمت المعالجة</div>
    </div>
  )
}
