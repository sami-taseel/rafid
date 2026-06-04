import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Buildings() {
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  async function load() {
    const { data } = await supabase.from('buildings').select('*').order('name')
    setBuildings(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!newName.trim()) return
    await supabase.from('buildings').insert({ name: newName.trim() })
    setNewName(''); load()
  }
  async function saveEdit(id) {
    await supabase.from('buildings').update({ name: editName }).eq('id', id)
    setEditId(null); load()
  }
  async function toggleHide(b) {
    // الإخفاء عبر بادئة في الاسم (حل بسيط دون تعديل قاعدة البيانات)
    const hidden = b.name.startsWith('[مخفي] ')
    const name = hidden ? b.name.replace('[مخفي] ', '') : '[مخفي] ' + b.name
    await supabase.from('buildings').update({ name }).eq('id', b.id); load()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <div className="panel">
        <h3>إضافة عمارة</h3>
        <div className="form-row">
          <input placeholder="اسم العمارة" value={newName} onChange={e => setNewName(e.target.value)} />
          <button onClick={add}>إضافة</button>
        </div>
      </div>
      <div className="panel">
        <h3>العمارات ({buildings.length})</h3>
        {buildings.map(b => {
          const hidden = b.name.startsWith('[مخفي] ')
          return (
            <div key={b.id} className="building-row">
              {editId === b.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1 }} />
                  <button className="mini" onClick={() => saveEdit(b.id)}>حفظ</button>
                  <button className="mini" onClick={() => setEditId(null)}>إلغاء</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, opacity: hidden ? 0.5 : 1 }}>🏢 {b.name}</span>
                  <button className="mini" onClick={() => { setEditId(b.id); setEditName(b.name) }}>تعديل</button>
                  <button className="mini" onClick={() => toggleHide(b)}>{hidden ? 'إظهار' : 'إخفاء'}</button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
