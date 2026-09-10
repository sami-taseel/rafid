import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'
import Icon from '../Icon'
import { Spinner } from './Students'

// إدارة مجموعات الإشراف: مشرف طالب + طلابه
export default function MonitorGroups() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [groups, setGroups] = useState([])
  const [students, setStudents] = useState([])
  const [members, setMembers] = useState({})   // {groupId: [studentId]}
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newMonitor, setNewMonitor] = useState('')
  const [editing, setEditing] = useState(null)  // المجموعة قيد إدارة أعضائها
  const [q, setQ] = useState('')

  async function load() {
    const [g, s, m] = await Promise.all([
      supabase.from('monitor_groups').select('*').order('created_at'),
      supabase.from('students').select('id, is_monitor, persons(full_name)'),
      supabase.from('monitor_group_members').select('group_id, student_id'),
    ])
    setGroups(g.data || [])
    setStudents(s.data || [])
    const map = {}
    ;(m.data || []).forEach(x => { (map[x.group_id] = map[x.group_id] || []).push(x.student_id) })
    setMembers(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const nameOf = id => students.find(s => s.id === id)?.persons?.full_name || '—'
  // الطالب مُسند لمجموعة أخرى؟
  function assignedElsewhere(sid, gid) {
    return Object.entries(members).some(([g, arr]) => g !== gid && arr.includes(sid))
  }

  async function createGroup() {
    if (!newName.trim()) { toast('اكتب اسم المجموعة', 'error'); return }
    const { error } = await supabase.from('monitor_groups')
      .insert({ name: newName.trim(), monitor_id: newMonitor || null })
    if (error) { toast('تعذّر الإنشاء: ' + error.message, 'error'); return }
    // نرفع علامة المشرف على الطالب المختار
    if (newMonitor) await supabase.from('students').update({ is_monitor: true }).eq('id', newMonitor)
    toast('أُنشئت المجموعة', 'success')
    setNewName(''); setNewMonitor(''); load()
  }

  async function setMonitor(g, sid) {
    const { error } = await supabase.from('monitor_groups').update({ monitor_id: sid || null }).eq('id', g.id)
    if (error) { toast('تعذّر التحديث', 'error'); return }
    if (sid) await supabase.from('students').update({ is_monitor: true }).eq('id', sid)
    toast('تم تعيين المشرف', 'success'); load()
  }

  async function toggleMember(gid, sid) {
    const cur = members[gid] || []
    if (cur.includes(sid)) {
      await supabase.from('monitor_group_members').delete().eq('group_id', gid).eq('student_id', sid)
      setMembers({ ...members, [gid]: cur.filter(x => x !== sid) })
    } else {
      if (assignedElsewhere(sid, gid)) { toast('الطالب مُسند لمجموعة أخرى', 'error'); return }
      const { error } = await supabase.from('monitor_group_members').insert({ group_id: gid, student_id: sid })
      if (error) { toast('تعذّر الإضافة', 'error'); return }
      setMembers({ ...members, [gid]: [...cur, sid] })
    }
  }

  async function delGroup(g) {
    const ok = await confirmDialog({
      title: 'حذف المجموعة',
      message: `سيتم حذف مجموعة «${g.name}» وفكّ ارتباط أعضائها. هل أنت متأكد؟`,
      confirmText: 'حذف', danger: true,
    })
    if (!ok) return
    await supabase.from('monitor_group_members').delete().eq('group_id', g.id)
    await supabase.from('monitor_groups').delete().eq('id', g.id)
    toast('حُذفت المجموعة', 'info'); load()
  }

  if (loading) return <Spinner />

  const unassigned = students.filter(s => !Object.values(members).flat().includes(s.id))

  return (
    <div>
      <h2 className="section-title">مجموعات الإشراف</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        كل مجموعة لها مشرف من الطلاب يتابع حضور أعضائها ويصعّد البلاغات عند تكرار الغياب.
      </p>

      {/* إنشاء مجموعة */}
      <div className="panel mg-create">
        <div className="mg-create-row">
          <div className="mg-field">
            <label>اسم المجموعة</label>
            <input placeholder="مثال: مجموعة الدور الأول" value={newName}
              onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="mg-field">
            <label>المشرف (طالب)</label>
            <select value={newMonitor} onChange={e => setNewMonitor(e.target.value)}>
              <option value="">اختر لاحقاً…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.persons?.full_name}</option>)}
            </select>
          </div>
          <button className="mg-add" onClick={createGroup}>＋ إنشاء</button>
        </div>
      </div>

      {/* المجموعات */}
      {groups.length === 0 && <div className="panel muted">لا مجموعات بعد. أنشئ الأولى أعلاه.</div>}
      {groups.map(g => {
        const mem = members[g.id] || []
        return (
          <div className="panel mg-card" key={g.id}>
            <div className="mg-head">
              <div className="mg-head-info">
                <div className="mg-name">{g.name}</div>
                <div className="mg-meta">
                  <span className="mg-monitor">
                    <Icon name="user" size={13} /> المشرف: {g.monitor_id ? nameOf(g.monitor_id) : 'غير محدّد'}
                  </span>
                  <span className="mg-count">{mem.length} عضو</span>
                </div>
              </div>
              <div className="mg-head-actions">
                <select className="mg-monitor-pick" value={g.monitor_id || ''}
                  onChange={e => setMonitor(g, e.target.value)}>
                  <option value="">تعيين مشرف…</option>
                  {mem.map(sid => <option key={sid} value={sid}>{nameOf(sid)}</option>)}
                </select>
                <button className="mini" onClick={() => setEditing(editing === g.id ? null : g.id)}>
                  {editing === g.id ? 'إغلاق' : 'إدارة الأعضاء'}
                </button>
                <button className="fr-del" onClick={() => delGroup(g)}>حذف</button>
              </div>
            </div>

            {/* أعضاء المجموعة */}
            {mem.length > 0 && (
              <div className="mg-members">
                {mem.map(sid => (
                  <span key={sid} className={'mg-chip' + (g.monitor_id === sid ? ' is-monitor' : '')}>
                    {g.monitor_id === sid && '★ '}{nameOf(sid)}
                    <button onClick={() => toggleMember(g.id, sid)} aria-label="إزالة">✕</button>
                  </span>
                ))}
              </div>
            )}

            {/* إضافة أعضاء */}
            {editing === g.id && (
              <div className="mg-picker">
                <input className="mg-search" placeholder="ابحث عن طالب…" value={q}
                  onChange={e => setQ(e.target.value)} />
                <div className="mg-pick-list">
                  {students
                    .filter(s => !q || (s.persons?.full_name || '').includes(q))
                    .filter(s => !mem.includes(s.id))
                    .slice(0, 60)
                    .map(s => {
                      const taken = assignedElsewhere(s.id, g.id)
                      return (
                        <button key={s.id} className={'mg-pick' + (taken ? ' taken' : '')}
                          onClick={() => toggleMember(g.id, s.id)} disabled={taken}
                          title={taken ? 'مُسند لمجموعة أخرى' : 'إضافة للمجموعة'}>
                          {s.persons?.full_name}
                          {taken && <span className="mg-taken-tag">مُسند</span>}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {unassigned.length > 0 && (
        <div className="panel mg-unassigned">
          <strong>{unassigned.length} طالباً بلا مجموعة</strong>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            الطالب بلا مجموعة يُعتمد حضوره مباشرة دون تأكيد مشرف.
          </p>
        </div>
      )}
    </div>
  )
}
