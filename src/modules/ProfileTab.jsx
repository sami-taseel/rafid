import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Companions from './Companions'
import StudentAttachments from './StudentAttachments'
import Icon from '../Icon'

// صفحة موحّدة تدمج: بياناتي + المرافقون + المرفقات
// بتبويبات أفقية فرعية، مع إظهار حالة اكتمال كل قسم
export default function ProfileTab({ studentId, personId, dataForm }) {
  const [sub, setSub] = useState('data')
  const [steps, setSteps] = useState(null)

  // نجلب حالة الخطوات لإظهار ✓ على كل تبويب فرعي
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

  return (
    <div className="profile-merged">
      {/* تبويبات فرعية أفقية */}
      <div className="psub-tabs">
        {subTabs.map(st => (
          <button key={st.key} className={'psub-tab' + (sub === st.key ? ' on' : '')} onClick={() => setSub(st.key)}>
            <span className="psub-ic"><Icon name={st.icon} size={17} /></span>
            <span className="psub-lbl">{st.label}</span>
            {st.done && <span className="psub-done"><Icon name="check" size={12} /></span>}
          </button>
        ))}
      </div>

      {/* محتوى القسم المختار */}
      <div className="psub-body">
        {sub === 'data' && dataForm}
        {sub === 'companions' && <Companions studentId={studentId} personId={personId} />}
        {sub === 'attachments' && <StudentAttachments studentId={studentId} />}
      </div>
    </div>
  )
}
