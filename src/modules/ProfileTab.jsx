import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Companions from './Companions'
import StudentAttachments from './StudentAttachments'
import StudentForms from './StudentForms'
import Icon from '../Icon'

// صفحة موحّدة تدمج: بياناتي + المرافقون + المرفقات + النماذج
// بتبويبات أفقية فرعية، مع إظهار حالة اكتمال كل قسم
// النماذج تظهر للمعتمد فقط، مع شارة عدد النماذج غير الموقّعة
export default function ProfileTab({ studentId, personId, dataForm, isApproved, signaturePath, unsignedVisible, initialSub }) {
  const [sub, setSub] = useState(initialSub || 'data')
  const [steps, setSteps] = useState(null)

  async function loadSteps() {
    if (!studentId) return
    const { data } = await supabase.rpc('onboarding_status', { p_student: studentId })
    setSteps(data?.[0] || null)
  }
  useEffect(() => { loadSteps() }, [studentId, sub])

  const s = steps || {}
  const subTabs = [
    { key: 'data', label: 'بياناتي', icon: 'user', done: s.fields_done },
    { key: 'companions', label: 'المرافقون', icon: 'users', done: s.companions_answered && s.companions_done },
    { key: 'attachments', label: 'المرفقات', icon: 'paperclip', done: s.attachments_done },
  ]
  // النماذج: تبويب رابع للمعتمد فقط، مع شارة عدد غير الموقّعة
  if (isApproved) subTabs.push({ key: 'forms', label: 'النماذج', icon: 'signature', done: unsignedVisible === 0, badge: unsignedVisible })

  return (
    <div className="profile-merged">
      <div className="psub-tabs">
        {subTabs.map(st => (
          <button key={st.key} className={'psub-tab' + (sub === st.key ? ' on' : '')} onClick={() => setSub(st.key)}>
            <span className="psub-ic"><Icon name={st.icon} size={17} /></span>
            <span className="psub-lbl">{st.label}</span>
            {st.badge > 0 ? <span className="psub-badge">{st.badge}</span> : st.done && <span className="psub-done"><Icon name="check" size={12} /></span>}
          </button>
        ))}
      </div>

      <div className="psub-body">
        {sub === 'data' && dataForm}
        {sub === 'companions' && <Companions studentId={studentId} personId={personId} />}
        {sub === 'attachments' && <StudentAttachments studentId={studentId} />}
        {sub === 'forms' && isApproved && <StudentForms studentId={studentId} signaturePath={signaturePath} />}
      </div>
    </div>
  )
}
