import { Component } from 'react'
import { supabase } from './supabaseClient'

// حدّ خطأ: يلتقط أعطال الواجهة، يعرض رسالة لطيفة، ويسجّل الخطأ
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error, info) {
    // تسجيل الخطأ (في جدول error_log إن وُجد) — بصمت
    try {
      supabase.from('error_log').insert({
        message: String(error?.message || error).slice(0, 500),
        stack: String(info?.componentStack || '').slice(0, 1000),
        url: window.location.href,
      }).then(() => {}).catch(() => {})
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="state" style={{ flexDirection: 'column', gap: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ color: '#1f3864' }}>حدث خطأ غير متوقّع</h2>
          <p className="muted">نعتذر، حدث خطأ في عرض هذه الصفحة. جرّب إعادة التحميل.</p>
          <button className="save-btn" style={{ width: 'auto', padding: '12px 28px' }} onClick={() => window.location.reload()}>إعادة تحميل الصفحة</button>
        </div>
      )
    }
    return this.props.children
  }
}
