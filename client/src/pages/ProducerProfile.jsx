import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, apiError } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { Alert, Empty, FormField, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import { TYPE_LABEL } from '../components/format.js';
import Icon from '../components/Icon.jsx';
import { date, dateTime, kg } from '../components/format.js';

/** W04 Producer Profile */
export default function ProducerProfile() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data: p, error, loading, reload, setData } = useFetch(`/producers/${id}`);
  const collections = useFetch(can('collection:read') ? '/collections' : null, { producerId: id, limit: 10 });

  if (loading && !p) return <Loading />;
  if (error) return <Alert>{error.status === 403 ? "You don't have access to this producer." : error.message}</Alert>;

  return (
    <>
      <PageHeader breadcrumb={<><Link to="/producers">Producers</Link> / {p.code}</>}
        title={<span className="row" style={{ gap: 10 }}>{p.fullName} <StatusBadge status={p.verificationStatus} /></span>}
        subtitle={`${p.code} · ${TYPE_LABEL[p.type]} · ${p.centre?.name} collection centre`}
        actions={can('collection:create') && p.verificationStatus === 'VERIFIED' && (
          <Link className="btn" to={`/collections/new?producer=${p._id}`}><Icon name="scale" size={16} /> Record collection</Link>
        )} />

      {p.verificationStatus === 'PENDING' && can('producer:verify') && (
        <VerifyPanel producer={p} onDone={(updated) => setData({ ...p, ...updated })} />
      )}
      {p.verificationStatus === 'PENDING' && !can('producer:verify') && (
        <div style={{ marginBottom: 16 }}><Alert tone="warning">Awaiting verification by Management. Leaf cannot be collected from this producer yet.</Alert></div>
      )}
      {p.verificationStatus === 'REJECTED' && (
        <div style={{ marginBottom: 16 }}><Alert>Rejected{p.rejectionReason ? `: ${p.rejectionReason}` : ''}</Alert></div>
      )}

      <div className="grid two">
        <div className="stack">
          <div className="card">
            <div className="card-header"><h2>Fields</h2><span className="muted small">{p.fields.length} registered</span></div>
            {p.fields.length === 0 ? <Empty title="No fields registered" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Field</th><th>Division</th><th>Variety</th><th className="num">Area (ha)</th><th>Status</th></tr></thead>
                  <tbody>
                    {p.fields.map((f) => (
                      <tr key={f._id}>
                        <td className="mono">{f.code}</td><td>{f.division || '—'}</td><td>{f.variety || '—'}</td>
                        <td className="num">{f.areaHa.toFixed(3)}</td><td><StatusBadge status={f.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {can('field:create') && p.verificationStatus !== 'REJECTED' && <AddField producerId={p._id} onAdded={reload} />}
          </div>

          {can('collection:read') && (
            <div className="card">
              <div className="card-header"><h2>Recent collections</h2>
                {p.collections && <span className="muted small">{p.collections.count} total · {kg(p.collections.totalNetKg)}</span>}
              </div>
              {collections.loading ? <Loading /> : collections.data?.items.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Date</th><th>Receipt</th><th>Field</th>{collections.data.items[0].batchCode !== undefined && <th>Batch ID</th>}<th className="num">Net</th></tr></thead>
                    <tbody>
                      {collections.data.items.map((c) => (
                        <tr key={c.id}>
                          <td className="nowrap">{dateTime(c.collectedAt)}</td>
                          <td>{can('receipt:read') ? <Link to={`/collections/${c.id}/receipt`}>{c.receiptNo}</Link> : c.receiptNo}</td>
                          <td className="mono small">{c.field?.code}</td>
                          {c.batchCode !== undefined && <td className="mono small">{c.batchCode}</td>}
                          <td className="num">{kg(c.netKg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty title="No collections yet" />}
            </div>
          )}
        </div>

        <div className="card card-body">
          <h2 style={{ marginBottom: 14 }}>Details</h2>
          <dl className="details">
            <dt>Code</dt><dd className="mono">{p.code}</dd>
            <dt>Type</dt><dd>{TYPE_LABEL[p.type]}</dd>
            <dt>NIC / Reg. no.</dt><dd className="mono">{p.nicOrRegNo}</dd>
            <dt>Phone</dt><dd>{p.phone || '—'}</dd>
            <dt>Address</dt><dd>{p.address || '—'}</dd>
            <dt>Centre</dt><dd>{p.centre?.name} ({p.centre?.district})</dd>
            {p.org && <><dt>Organisation</dt><dd>{p.org.name}</dd></>}
            <dt>Registered</dt><dd>{date(p.createdAt)}{p.registeredBy && ` by ${p.registeredBy.fullName}`}</dd>
            {p.verifiedBy && <><dt>{p.verificationStatus === 'REJECTED' ? 'Rejected' : 'Verified'}</dt><dd>{date(p.verifiedAt)} by {p.verifiedBy.fullName}</dd></>}
          </dl>
        </div>
      </div>
    </>
  );
}

function VerifyPanel({ producer, onDone }) {
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const act = async (kind) => {
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post(`/producers/${producer._id}/${kind}`, kind === 'reject' ? { reason } : {});
      onDone(data);
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <div className="card card-body" style={{ marginBottom: 16, borderColor: 'var(--warning)', background: 'var(--warning-bg)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>Verification required</h2>
          <div className="small muted">Check the NIC / registration documents, then approve or reject this producer.</div>
        </div>
        {mode !== 'reject' && (
          <div className="row">
            <button type="button" className="btn danger" disabled={busy} onClick={() => setMode('reject')}><Icon name="x" size={16} /> Reject</button>
            <button type="button" className="btn" disabled={busy} onClick={() => act('verify')}><Icon name="check" size={16} /> Approve</button>
          </div>
        )}
      </div>
      {mode === 'reject' && (
        <div className="form" style={{ marginTop: 14 }}>
          <FormField label="Reason for rejection" htmlFor="reason" error={err?.fields.reason}>
            <textarea id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </FormField>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setMode(null)}>Cancel</button>
            <button type="button" className="btn danger" disabled={busy} onClick={() => act('reject')}>Confirm rejection</button>
          </div>
        </div>
      )}
      {err && !err.fields.reason && <div style={{ marginTop: 10 }}><Alert>{err.message}</Alert></div>}
    </div>
  );
}

function AddField({ producerId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ division: '', areaHa: '', variety: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api.post(`/producers/${producerId}/fields`, { ...f, areaHa: f.areaHa === '' ? undefined : Number(f.areaHa) });
      setF({ division: '', areaHa: '', variety: '' }); setOpen(false); onAdded();
    } catch (e2) { setErr(apiError(e2)); } finally { setBusy(false); }
  };
  if (!open) return <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}><button type="button" className="btn secondary sm" onClick={() => setOpen(true)}><Icon name="plus" size={14} /> Add field</button></div>;
  return (
    <form className="card-body form" style={{ borderTop: '1px solid var(--border)' }} onSubmit={submit} noValidate>
      <div className="form-grid">
        <FormField label="Division" error={err?.fields.division}><input className="input" value={f.division} onChange={(e) => setF({ ...f, division: e.target.value })} /></FormField>
        <FormField label="Area (ha)" error={err?.fields.areaHa}><input className={`input ${err?.fields.areaHa ? 'invalid' : ''}`} inputMode="decimal" value={f.areaHa} onChange={(e) => setF({ ...f, areaHa: e.target.value })} /></FormField>
        <FormField label="Variety" error={err?.fields.variety}><input className="input" value={f.variety} onChange={(e) => setF({ ...f, variety: e.target.value })} placeholder="e.g. TRI 2025" /></FormField>
      </div>
      {err && !Object.keys(err.fields).length && <Alert>{err.message}</Alert>}
      <div className="row"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={busy}>Save field</button></div>
    </form>
  );
}
