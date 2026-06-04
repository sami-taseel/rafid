export default function Certificate({ name, activity, date, onClose }) {
  function printCert() { window.print() }
  return (
    <div className="cert-overlay">
      <div className="cert-wrap">
        <div className="cert" id="cert-print">
          <img src="/logo.png" alt="تأصيل" className="cert-logo" />
          <div className="cert-title">شهادة إتمام</div>
          <div className="cert-body">تشهد جمعية تأصيل التعليمية بأن</div>
          <div className="cert-name">{name}</div>
          <div className="cert-body">قد أتمّ بنجاح</div>
          <div className="cert-activity">{activity}</div>
          <div className="cert-date">{date}</div>
          <div className="cert-seal">منصة رافد — مشروع طلاب المنح الدوليين</div>
        </div>
        <div className="cert-actions no-print">
          <button className="mini" onClick={printCert}>طباعة / حفظ PDF</button>
          <button className="mini" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}
