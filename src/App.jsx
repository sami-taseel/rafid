import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        // نجلب الطلاب مع بيانات الشخص المرتبطة بهم
        const { data, error } = await supabase
          .from('students')
          .select('id, degree_level, persons(full_name, nationality, residency_no, phone)')

        if (error) throw error
        setStudents(data || [])
      } catch (err) {
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // إحصاءات سريعة
  const total = students.length
  const byDegree = students.reduce((acc, s) => {
    const d = s.degree_level || 'غير محدد'
    acc[d] = (acc[d] || 0) + 1
    return acc
  }, {})
  const nationalities = new Set(
    students.map(s => s.persons?.nationality).filter(Boolean)
  ).size

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>منصة رافد</h1>
          <span>جمعية تأصيل التعليمية — طلاب المنح الدوليين</span>
        </div>
        <div className="meta">لوحة مدير النظام</div>
      </header>

      <div className="container">
        {loading && (
          <div className="state">
            <div className="spinner"></div>
            جارٍ تحميل البيانات من قاعدة البيانات…
          </div>
        )}

        {error && (
          <div className="error-box">
            <strong>تعذّر الاتصال بقاعدة البيانات.</strong><br />
            تأكد من ضبط مفاتيح Supabase بشكل صحيح. تفاصيل الخطأ:<br />
            <code>{error}</code>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="stats">
              <div className="stat-card">
                <div className="num">{total}</div>
                <div className="label">إجمالي الطلاب</div>
              </div>
              <div className="stat-card">
                <div className="num">{nationalities}</div>
                <div className="label">عدد الجنسيات</div>
              </div>
              {Object.entries(byDegree).map(([deg, n]) => (
                <div className="stat-card" key={deg}>
                  <div className="num">{n}</div>
                  <div className="label">{deg}</div>
                </div>
              ))}
            </div>

            <h2 className="section-title">قائمة الطلاب</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الاسم</th>
                    <th>الجنسية</th>
                    <th>المرحلة</th>
                    <th>رقم الإقامة</th>
                    <th>الجوال</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td className="muted">{i + 1}</td>
                      <td>{s.persons?.full_name || '—'}</td>
                      <td>
                        {s.persons?.nationality
                          ? <span className="pill">{s.persons.nationality}</span>
                          : <span className="muted">غير محدد</span>}
                      </td>
                      <td>{s.degree_level || '—'}</td>
                      <td className="muted">{s.persons?.residency_no || '—'}</td>
                      <td className="muted">{s.persons?.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
