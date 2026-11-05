import { Link, useLocation, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../api/useFetch.js';
import { Alert, Loading } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { dateTime, kg } from '../components/format.js';

/** M07 Collection Receipt — printable, with a QR code of the Green-Leaf Batch ID. */
export default function Receipt() {
  const { id } = useParams();
  const { state } = useLocation();
  const { can } = useAuth();
  const fromState = state?.receipt?.id === id ? state.receipt : null;
  const { data, error, loading } = useFetch(fromState ? null : `/collections/${id}/receipt`);
  const r = fromState || data;

  if (loading && !r) return <Loading />;
  if (error) return <Alert>{error.status === 403 ? "You don't have access to this receipt." : error.message}</Alert>;

  return (
    <div className="stack" style={{ maxWidth: 440, margin: '0 auto' }}>
      {state?.justCreated && <div className="no-print"><Alert tone="success">Collection saved. Hand the printed receipt to the producer.</Alert></div>}
      <div className="card receipt">
        <div className="head">
          <div className="ok-icon"><Icon name="leaf" size={22} /></div>
          <h2>Green-leaf collection receipt</h2>
          <div className="muted small">Smart Tea · {r.centre?.name ? `${r.centre.name} collection centre` : 'Collection centre'}</div>
          <div className="mono" style={{ marginTop: 8, fontWeight: 600 }}>{r.receiptNo}</div>
        </div>
        <div className="lines">
          <div className="line"><span>Date &amp; time</span><span>{dateTime(r.collectedAt)}</span></div>
          <div className="line"><span>Producer</span><span>{r.producer.fullName}<br /><span className="muted small mono">{r.producer.code}</span></span></div>
          <div className="line"><span>Field</span><span className="mono">{r.field.code}{r.field.division ? ` · ${r.field.division}` : ''}</span></div>
          <div className="line"><span>Collector</span><span>{r.collector.fullName}</span></div>
          <div className="line"><span>Gross weight</span><span>{kg(r.grossKg)}</span></div>
          <div className="line"><span>Tare weight</span><span>− {kg(r.tareKg)}</span></div>
          <div className="line net-line"><span>Net weight</span><span>{kg(r.netKg)}</span></div>
        </div>
        <div className="qr">
          <QRCodeSVG value={r.batchCode} size={148} level="M" marginSize={0} />
          <div className="batch">{r.batchCode}</div>
          <div className="muted small">Green-Leaf Batch ID — scan to trace this leaf</div>
        </div>
      </div>
      <div className="row no-print" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn" onClick={() => window.print()}><Icon name="print" size={16} /> Print receipt</button>
        {can('collection:create') && <Link className="btn secondary" to="/collections/new"><Icon name="plus" size={16} /> New collection</Link>}
        <Link className="btn ghost" to="/collections">All collections</Link>
      </div>
    </div>
  );
}
