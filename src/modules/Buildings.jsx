import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'

export default function Buildings() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [buildings, setBuildings] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [newB, setNewB] = useState({ name: '', building_type: 'singles' })
  const [editId, setEditId] = useState(null)
  const [editB, setEditB] = useState({ name: '', building_type: 'singles' })
  const [expandedB, setExpandedB] = useState(null)
  const [newU, setNewU] = useState({ unit_no: '', rooms: 1 })

  async function load() {
    const [b, u] = await Promise.all([
      supabase.from('buildings').select('*').order('name'),
      supabase.from('units').select('*').order('unit_no'),
    ])
    setBuildings(b.data || []); setUnits(u.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addBuilding() {
    if (!newB.name.trim()) { toast('اكتب اسم العمارة', 'error'); return }
    await supabase.from('buildings').insert({ name: newB.name.trim(), building_type: newB.building_type })
    setNewB({ name: '', building_type: 'singles' }); toast('أُضيفت العمارة'); load()
  }
  async function saveEdit(id) {
    await supabase.from('buildings').update({ name: editB.name, building_type: editB.building_type }).eq('id', id)
    setEditId(null); toast('تم التعديل'); load()
  }
  async function toggleHide(b) {
    const hidden = b.name.startsWith('[مخفي] ')
    const name = hidden ? b.name.replace('[مخفي] ', '') : '[مخفي] ' + b.name
    await supabase.from('buildings').update({ name }).eq('id', b.id); load()
  }
  async function delBuilding(b) {
    const cnt = units.filter(u => u.building_id === b.id).length
    const ok = await confirmDialog({ title: 'حذف العمارة', message: cnt > 0 ? `هذه العمارة بها ${cnt} شقة ستُحذف معها.` : 'سيتم حذف العمارة.', confirmText: 'احذف', danger: true })
    if (!ok) return
    await supabase.from('buildings').delete().eq('id', b.id); toast('تم الحذف'); load()
  }

  async function addUnit(buildingId) {
    if (!newU.unit_no.trim()) { toast('اكتب رقم الشقة', 'error'); return }
    await supabase.from('units').insert({ building_id: buildingId, unit_no: newU.unit_no.trim(), rooms: Number(newU.rooms) || 1 })
    setNewU({ unit_no: '', rooms: 1 }); load()
  }
  async function delUnit(id) {
    const ok = await confirmDialog({ title: 'حذف الشقة', message: 'سيتم حذف هذه الشقة.', confirmText: 'احذف', danger: true })
    if (!ok) return
    await supabase.from('units').delete().eq('id', id); load()
  }

  if (loading) return <Spinner />
  const typeLabel = (t) => t === 'families' ? 'عوائل' : 'عزّاب'

  return (
    <div>
      <div className="panel">
        <h3>إضافة عمارة</h3>
        <div className="form-row">
          <input placeholder="اسم العمارة" value={newB.name} onChange={e => setNewB({ ...newB, name: e.target.value })} />
          <select value={newB.building_type} onChange={e => setNewB({ ...newB, building_type: e.target.value })}>
            <option value="singles">عزّاب (عدة طلاب بالشقة)</option>
            <option value="families">عوائل (طالب واحد بالشقة)</option>
          </select>
          <button onClick={addBuilding}>إضافة</button>
        </div>
      </div>

      <div className="panel">
        <h3>العمارات ({buildings.length})</h3>
        {buildings.map(b => {
          const hidden = b.name.startsWith('[مخفي] ')
          const bUnits = units.filter(u => u.building_id === b.id)
          const totalRooms = bUnits.reduce((s, u) => s + (u.rooms || 0), 0)
          const expanded = expandedB === b.id
          return (
            <div key={b.id} className="bldg-card">
              {editId === b.id ? (
                <div className="form-row">
                  <input value={editB.name} onChange={e => setEditB({ ...editB, name: e.target.value })} />
                  <select value={editB.building_type} onChange={e => setEditB({ ...editB, building_type: e.target.value })}>
                    <option value="singles">عزّاب</option><option value="families">عوائل</option>
                  </select>
                  <button className="mini" onClick={() => saveEdit(b.id)}>حفظ</button>
                  <button className="mini" onClick={() => setEditId(null)}>إلغاء</button>
                </div>
              ) : (
                <div className="bldg-head">
                  <div className="bldg-info" onClick={() => setExpandedB(expanded ? null : b.id)}>
                    <span className="bldg-chevron">{expanded ? '▾' : '▸'}</span>
                    <strong>{hidden ? b.name.replace('[مخفي] ', '') : b.name}</strong>
                    {hidden && <span className="pill-off">مخفية</span>}
                    <span className={'bldg-type ' + b.building_type}>{typeLabel(b.building_type)}</span>
                    <span className="muted">{bUnits.length} شقة · {totalRooms} غرفة</span>
                  </div>
                  <div className="sess-actions">
                    <button className="mini" onClick={() => setExpandedB(expanded ? null : b.id)}>{expanded ? 'إخفاء الشقق' : '🏠 إدارة الشقق'}</button>
                    <button className="mini" onClick={() => { setEditId(b.id); setEditB({ name: hidden ? b.name.replace('[مخفي] ', '') : b.name, building_type: b.building_type || 'singles' }) }}>تعديل</button>
                    <button className="mini" onClick={() => toggleHide(b)}>{hidden ? 'إظهار' : 'إخفاء'}</button>
                    <button className="fr-del" onClick={() => delBuilding(b)}>حذف</button>
                  </div>
                </div>
              )}

              {expanded && (
                <div className="units-section">
                  <div className="units-grid">
                    {bUnits.map(u => (
                      <div key={u.id} className="unit-chip">
                        <span className="unit-no">شقة {u.unit_no}</span>
                        <span className="unit-rooms">{u.rooms} غرفة</span>
                        <button className="unit-del" onClick={() => delUnit(u.id)}>✕</button>
                      </div>
                    ))}
                    {bUnits.length === 0 && <span className="muted" style={{ fontSize: 13 }}>لا شقق بعد.</span>}
                  </div>
                  <div className="add-unit-row">
                    <input placeholder="رقم الشقة" value={newU.unit_no} onChange={e => setNewU({ ...newU, unit_no: e.target.value })} style={{ width: 110 }} />
                    <input type="number" placeholder="الغرف" value={newU.rooms} onChange={e => setNewU({ ...newU, rooms: e.target.value })} style={{ width: 90 }} min={1} />
                    <button className="mini" onClick={() => addUnit(b.id)}>+ إضافة شقة</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
