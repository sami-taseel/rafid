export default function Empty({ icon = '📭', title, hint, action, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action && <button className="mini" onClick={onAction}>{action}</button>}
    </div>
  )
}
