import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icon'
import { formatTime, formatDate } from './dateUtils'

export default function SponsorPortal({ session }) {
  const [tab, setTab] = useState('overview')
  const [an, setAn] = useState(null)
  const [students, setStudents] = useState([])
  const [trend, setTrend] = useState([])
  const [nats, setNats] = useState([])
  const [degs, setDegs] = useState([])
  const [acts, setActs] = useState([])
  const [sessSum, setSessSum] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [comps, setComps] = useState([])
  const [byYear, setByYear] = useState([])
  const [byGender, setByGender] = useState([])
  const [byAdm, setByAdm] = useState([])
  const [byAcct, setByAcct] = useState([])
  const [housing, setHousing] = useState([])
  const [topPoints, setTopPoints] = useState([])
  const [topAtt, setTopAtt] = useState([])
  const [evalBuckets, setEvalBuckets] = useState([])
  const [formsSum, setFormsSum] = useState(null)
  const [extraKpis, setExtraKpis] = useState(null)
  const [sponsorName, setSponsorName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [a, det, tr, me, na, dg, ac, ss, up, co,
             yr, gn, adm, acct, hs, tp, ta, eb, fs, ek] = await Promise.all([
        supabase.rpc('sponsor_analytics'),
        supabase.rpc('sponsor_student_full'),
        supabase.rpc('sponsor_attendance_trend'),
        supabase.from('persons').select('full_name, sponsors(name)').eq('auth_user_id', session.user.id).maybeSingle(),
        supabase.rpc('sponsor_nationalities'),
        supabase.rpc('sponsor_degrees'),
        supabase.rpc('sponsor_activities_by_track'),
        supabase.rpc('sponsor_sessions_summary'),
        supabase.rpc('sponsor_upcoming_sessions'),
        supabase.rpc('sponsor_companions'),
        supabase.rpc('sponsor_by_year'),
        supabase.rpc('sponsor_by_gender'),
        supabase.rpc('sponsor_by_admission'),
        supabase.rpc('sponsor_by_account_state'),
        supabase.rpc('sponsor_housing'),
        supabase.rpc('sponsor_top_points'),
        supabase.rpc('sponsor_top_attendance'),
        supabase.rpc('sponsor_eval_buckets'),
        supabase.rpc('sponsor_forms_summary'),
        supabase.rpc('sponsor_extra_kpis'),
      ])
      setAn(a.data?.[0] || null); setStudents(det.data || []); setTrend(tr.data || [])
      setSponsorName(me.data?.sponsors?.name || me.data?.full_name || 'الجهة الداعمة')
      setNats(na.data || []); setDegs(dg.data || []); setActs(ac.data || [])
      setSessSum(ss.data?.[0] || null); setUpcoming(up.data || []); setComps(co.data || [])
      setByYear(yr.data || []); setByGender(gn.data || []); setByAdm(adm.data || [])
      setByAcct(acct.data || []); setHousing(hs.data || []); setTopPoints(tp.data || [])
      setTopAtt(ta.data || []); setEvalBuckets(eb.data || []); setFormsSum(fs.data?.[0] || null)
      setExtraKpis(ek.data?.[0] || null)
      setLoading(false)
    }
    load()
  }, [session])

  async function logout() { await supabase.auth.signOut() }
  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  const PALETTE = ['#2e5496', '#1d9e75', '#e0a800', '#6b3fc0', '#c0392b', '#157080', '#d2691e', '#9aa3b2']
  const statusLabels = { active: 'نشط', pending: 'مراجعة', interview: 'مقابلة', accepted: 'مقبول', rejected: 'مرفوض', frozen: 'مجمّد' }
  const totalComps = comps.reduce((s, c) => s + Number(c.cnt), 0)

  const tabs = [
    { key: 'overview', label: 'نظرة عامة', icon: 'chart' },
    { key: 'students', label: 'الطلاب', icon: 'users' },
    { key: 'activities', label: 'الأنشطة', icon: 'book' },
  ]

  return (
    <div className="sponsor-portal">
      <header className="sp-portal-head">
        <div className="sp-portal-brand"><img src="/logo-white.png" alt="رافد" className="sp-portal-logo" /><span className="sp-portal-title">بوابة الجهة الداعمة</span></div>
        <button className="sp-logout" onClick={logout}><Icon name="logout" size={16} /> خروج</button>
      </header>

      <div className="sp-portal-body">
        <div className="sp-hero-card">
          <div className="sp-hero-av">{sponsorName.charAt(0)}</div>
          <div>
            <h2 className="sp-greeting" style={{ color: '#fff' }}>{sponsorName}</h2>
            <p className="muted">متابعة الطلاب المكفولين في منصة رافد</p>
          </div>
        </div>

        {/* تبويبات */}
        <div className="spx-tabs">
          {tabs.map(t => (
            <button key={t.key} className={'spx-tab' + (tab === t.key ? ' on' : '')} onClick={() => setTab(t.key)}>
              <Icon name={t.icon} size={18} /><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ===== نظرة عامة ===== */}
        {tab === 'overview' && an && (
          <>
            <div className="sp-kpis">
              <SpKpi icon="users" n={an.total} l="الطلاب المكفولون" />
              <SpKpi icon="check" n={an.avg_attendance + '%'} l="متوسط الحضور" />
              <SpKpi icon="star" n={an.avg_eval + '%'} l="متوسط التقييم" />
              <SpKpi icon="trophy" n={an.total_points} l="مجموع النقاط" />
              <SpKpi icon="home_door" n={an.housed} l="مسكّنون" />
              <SpKpi icon="handshake" n={an.total_support} l="مساعدات" />
              {extraKpis && <>
                <SpKpi icon="users" n={extraKpis.total_companions} l="إجمالي المرافقين" />
                <SpKpi icon="paperclip" n={extraKpis.total_attachments} l="المرفقات المرفوعة" />
                <SpKpi icon="check" n={extraKpis.completed_profiles} l="ملفات مكتملة" />
                <SpKpi icon="book" n={extraKpis.total_activities} l="الأنشطة المتاحة" />
                <SpKpi icon="user" n={extraKpis.avg_age || '—'} l="متوسط العمر" />
                <SpKpi icon="alert" n={extraKpis.open_tickets} l="بلاغات مفتوحة" />
              </>}
            </div>

            {/* مؤشر صحة الكفالة */}
            <div className="sp-chart-card">
              <h3 className="dash-sec">مؤشر صحة الكفالة</h3>
              <HealthGauge score={Math.round(((an.avg_attendance || 0) + (an.avg_eval || 0)) / 2)} />
            </div>

            <div className="sp-charts">
              {trend.length > 1 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">اتجاه الحضور (آخر ٦ أشهر)</h3>
                  <SpLine data={trend.map(t => ({ label: t.month.slice(5) + '/' + t.month.slice(2, 4), value: t.rate }))} />
                </div>
              )}
              {nats.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">توزيع الجنسيات</h3>
                  <SpDonut segments={nats.map((n, i) => ({ label: n.nationality, value: Number(n.cnt), color: PALETTE[i % 8] }))} unit="طالب" />
                </div>
              )}
              {byYear.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">السنة الدراسية (سنة الالتحاق)</h3>
                  <SpBars data={byYear.map(y => ({ label: y.year, value: Number(y.cnt) }))} color="#157080" />
                </div>
              )}
              {comps.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">المرافقون حسب صلة القرابة ({totalComps})</h3>
                  <SpDonut segments={comps.map((c, i) => ({ label: c.relation, value: Number(c.cnt), color: PALETTE[i % 8] }))} unit="مرافق" />
                </div>
              )}
              {byGender.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">توزيع الجنس</h3>
                  <SpDonut segments={byGender.map((g) => ({ label: g.gender, value: Number(g.cnt), color: g.gender === 'إناث' ? '#c264a0' : '#2e5496' }))} unit="طالب" />
                </div>
              )}
              {degs.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">المراحل الدراسية</h3>
                  <SpBars data={degs.map(d => ({ label: d.degree, value: Number(d.cnt) }))} color="#6b3fc0" />
                </div>
              )}
              {byAdm.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">حالات القبول</h3>
                  <SpDonut segments={byAdm.map((a2, i) => ({ label: statusLabels[a2.status] || a2.status, value: Number(a2.cnt), color: PALETTE[i % 8] }))} unit="طالب" />
                </div>
              )}
              {byAcct.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">اكتمال الحسابات</h3>
                  <SpBars data={byAcct.map(a2 => ({ label: { pending_data: 'يكمل بياناته', pending_approval: 'بانتظار الاعتماد', approved: 'معتمد', active: 'مكتمل' }[a2.state] || a2.state, value: Number(a2.cnt) }))} color="#1d9e75" />
                </div>
              )}
              {housing.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">توزيع السكن</h3>
                  <SpDonut segments={housing.map((h, i) => ({ label: h.kind, value: Number(h.cnt), color: PALETTE[i % 8] }))} unit="طالب" />
                </div>
              )}
              {evalBuckets.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">شرائح التقييم</h3>
                  <SpBars data={evalBuckets.map(e => ({ label: e.bucket, value: Number(e.cnt) }))} color="#e0a800" />
                </div>
              )}
              {formsSum && (Number(formsSum.signed) + Number(formsSum.pending)) > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">النماذج والموافقات</h3>
                  <SpBars data={[
                    { label: 'موقّعة', value: Number(formsSum.signed) },
                    { label: 'بانتظار التوقيع', value: Number(formsSum.pending) },
                  ]} color="#2e5496" />
                </div>
              )}
              {sessSum && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">الجلسات: المقررة مقابل ما تم حضوره</h3>
                  <SpBars data={[
                    { label: 'مقررة', value: Number(sessSum.planned) },
                    { label: 'تم حضورها', value: Number(sessSum.attended) },
                    { label: 'غياب', value: Number(sessSum.missed) },
                  ]} color="#2e5496" />
                </div>
              )}
              {topPoints.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">أعلى الطلاب نقاطاً</h3>
                  <SpBars data={topPoints.map(t => ({ label: t.name, value: Number(t.points) }))} color="#e0a800" />
                </div>
              )}
              {topAtt.length > 0 && (
                <div className="sp-chart-card">
                  <h3 className="dash-sec">أعلى الطلاب حضوراً</h3>
                  <SpBars data={topAtt.map(t => ({ label: t.name, value: Number(t.rate) }))} suffix="%" max={100} color="#1d9e75" />
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== الطلاب ===== */}
        {tab === 'students' && (
          <>
            <h3 className="section-title">الطلاب المكفولون ({students.length})</h3>
            {students.length === 0 && <div className="sp-chart-card muted">لا يوجد طلاب مرتبطون بجهتكم بعد.</div>}
            <div className="sp-students-full">
              {students.map(s => <StudentCardFull key={s.student_id} s={s} statusLabels={statusLabels} />)}
            </div>
          </>
        )}

        {/* ===== الأنشطة ===== */}
        {tab === 'activities' && (
          <>
            {sessSum && (
              <div className="sp-kpis">
                <SpKpi icon="calendar" n={sessSum.planned} l="جلسات مقررة" />
                <SpKpi icon="check" n={sessSum.attended} l="جلسات تم حضورها" />
                <SpKpi icon="x" n={sessSum.missed} l="جلسات فائتة" />
              </div>
            )}
            {acts.length > 0 && (
              <div className="sp-chart-card">
                <h3 className="dash-sec">الأنشطة حسب المسار</h3>
                <SpBars data={acts.map(a => ({ label: a.track, value: Number(a.activities) }))} color="#157080" />
              </div>
            )}
            <div className="sp-chart-card">
              <h3 className="dash-sec">الأنشطة القادمة</h3>
              {upcoming.length === 0 && <div className="muted" style={{ fontSize: 13 }}>لا أنشطة قادمة.</div>}
              <div className="sp-upcoming-list">
                {upcoming.map(u => (
                  <div key={u.session_id} className="sp-up-item">
                    <div className="sp-up-date">
                      <div className="d-num">{u.planned_date?.slice(8, 10)}</div>
                      <div className="d-mon">{u.planned_date?.slice(5, 7)}</div>
                    </div>
                    <div className="sp-up-body">
                      <div className="sp-up-title">{u.title}</div>
                      <div className="sp-up-meta">{u.track}{u.location && ' · ' + u.location}{u.start_time && ' · ' + formatTime(u.start_time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// بطاقة طالب قابلة للتوسّع
function StudentCardFull({ s, statusLabels }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sp-student-card">
      <div className="sp-student-top" onClick={() => setOpen(!open)}>
        <div className="sp-student-id">
          <div className="sp-student-av">{(s.full_name || '؟').charAt(0)}</div>
          <div>
            <div className="sp-student-name">{s.full_name}</div>
            <div className="sp-student-meta">{[s.nationality, s.degree_level].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <span className={'adm-badge adm-' + (s.admission_status || 'active')}>{statusLabels[s.admission_status] || 'نشط'}</span>
      </div>
      <div className="sp-student-bar">
        <div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: s.attendance_rate + '%' }}></div></div>
        <span className="sp-bar-val">{s.attendance_rate}% حضور</span>
      </div>
      <div className="sp-student-chips">
        <span className="sp-chip"><Icon name="calendar" size={12} /> {s.sessions_attended}/{s.sessions_planned} جلسة</span>
        <span className="sp-chip gold"><Icon name="trophy" size={12} /> {s.points} نقطة</span>
        {s.last_eval > 0 && <span className="sp-chip blue"><Icon name="star" size={12} /> {s.last_eval}%</span>}
      </div>
      {open && (
        <div className="sp-student-detail">
          <DetailRow label="حالة الحساب" value={{ pending_data: 'يكمل بياناته', pending_approval: 'بانتظار الاعتماد', approved: 'معتمد', active: 'مكتمل' }[s.account_state] || '—'} />
          <DetailRow label="السكن" value={s.building_name || 'غير مسكّن'} />
          <DetailRow label="الجلسات المقررة" value={s.sessions_planned} />
          <DetailRow label="الجلسات المحضورة" value={s.sessions_attended} />
          <DetailRow label="المرافقون" value={s.companions_count} />
          <DetailRow label="المرفقات" value={s.attachments_count} />
        </div>
      )}
      <button className="sp-student-toggle" onClick={() => setOpen(!open)}>
        {open ? 'إخفاء التفاصيل' : 'عرض التفاصيل'} <Icon name={open ? 'chevronLeft' : 'chevronRight'} size={13} />
      </button>
    </div>
  )
}
function DetailRow({ label, value }) {
  return <div className="sp-detail-row"><span className="muted">{label}</span><strong>{value}</strong></div>
}

function SpKpi({ icon, n, l }) {
  return <div className="sp-kpi"><div className="sp-kpi-ic"><Icon name={icon} size={20} /></div><div className="sp-kpi-num">{n}</div><div className="sp-kpi-lbl">{l}</div></div>
}

function SpBars({ data, color = '#2e5496', suffix = '', max = null }) {
  const mx = max || Math.max(...data.map(d => d.value), 1)
  return <div className="bars">{data.map((d, i) => (
    <div key={i} className="bar-row"><span className="bar-label">{d.label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: (d.value / mx * 100) + '%', background: color }}></div></div>
      <span className="bar-val">{d.value}{suffix}</span></div>))}</div>
}

function SpLine({ data }) {
  const mx = Math.max(...data.map(d => d.value), 100)
  const w = 100, h = 50
  const pts = data.map((d, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (d.value / mx) * h}`).join(' ')
  return (
    <div className="sp-line-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="sp-line-svg">
        <polyline points={pts} fill="none" stroke="#2e5496" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="sp-line-labels">{data.map((d, i) => <span key={i}>{d.label}<br /><strong>{d.value}%</strong></span>)}</div>
    </div>
  )
}

function SpDonut({ segments, unit = 'عنصر' }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className="muted" style={{ textAlign: 'center', padding: 20 }}>لا بيانات</div>
  let acc = 0
  const stops = segments.filter(s => s.value > 0).map(s => {
    const start = acc / total * 360; acc += s.value; const end = acc / total * 360
    return `${s.color} ${start}deg ${end}deg`
  }).join(', ')
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
        <div className="donut-hole"><span className="donut-total">{total}</span><span className="donut-lbl">{unit}</span></div>
      </div>
      <div className="donut-legend">
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div key={i} className="dl-item"><span className="dl-dot" style={{ background: s.color }}></span>{s.label} ({s.value})</div>
        ))}
      </div>
    </div>
  )
}

function HealthGauge({ score }) {
  const color = score >= 75 ? '#1d9e75' : score >= 50 ? '#e0a800' : '#c0392b'
  const label = score >= 75 ? 'ممتاز' : score >= 50 ? 'جيد' : 'يحتاج متابعة'
  return (
    <div className="health-gauge">
      <div className="health-circle" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #eef1f6 0deg)` }}>
        <div className="health-inner"><span className="health-num">{score}</span><span className="health-pct">%</span></div>
      </div>
      <div className="health-info">
        <div className="health-label" style={{ color }}>{label}</div>
        <p className="muted" style={{ fontSize: 12 }}>مزيج من متوسط الحضور والتقييم لطلابك.</p>
      </div>
    </div>
  )
}
