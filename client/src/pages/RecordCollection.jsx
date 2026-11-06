import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiError } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { Alert, FieldError, FormField, PageHeader, StatusBadge } from '../components/ui.jsx';
import { TYPE_LABEL } from '../components/format.js';
import Icon from '../components/Icon.jsx';

/** Same rule as server/src/rules/netWeight.js — used only for instant feedback; the server decides. */
function checkWeights(grossText, tareText) {
  const errors = {};
  const g = grossText.trim() === '' ? null : Number(grossText);
  const t = tareText.trim() === '' ? null : Number(tareText);
  if (g !== null && !Number.isFinite(g)) errors.grossKg = 'Gross weight must be a number';
  else if (g !== null && g <= 0) errors.grossKg = 'Gross weight must be greater than 0';
  if (t !== null && !Number.isFinite(t)) errors.tareKg = 'Tare weight must be a number';
  else if (t !== null && t < 0) errors.tareKg = 'Tare weight cannot be negative';
  else if (t !== null && Number.isFinite(g) && g > 0 && t >= g) errors.tareKg = 'Tare weight must be less than gross weight';
  const net = Number.isFinite(g) && Number.isFinite(t) && !errors.grossKg && !errors.tareKg ? Math.round((g - t) * 1000) / 1000 : null;
  return { errors, net };
}

/** Send numbers as numbers, anything else as typed so the server can reject it with a field error. */
const toPayload = (s) => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Number(s) : s);

/** M06 Weigh & Record — mobile-first. */
export default function RecordCollection() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [picked, setPicked] = useState(undefined); // undefined = not chosen yet (fall back to ?producer=)
  const [pickedField, setPickedField] = useState('');
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [touched, setTouched] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // Pre-select a producer from ?producer=<id> (link on the producer profile).
  const preId = params.get('producer');
  const pre = useFetch(preId && picked === undefined ? `/producers/${preId}` : null);
  const producer = picked === undefined ? pre.data : picked;

  const fields = useFetch(producer ? `/producers/${producer._id}/fields` : null);
  const activeFields = (fields.data?.items ?? []).filter((f) => f.status === 'ACTIVE');
  // A producer with a single field gets it pre-selected.
  const fieldId = pickedField || (activeFields.length === 1 ? activeFields[0]._id : '');

  const { errors: local, net } = useMemo(() => checkWeights(gross, tare), [gross, tare]);
  const fieldError = (k) => err?.fields[k] || (touched[k] ? local[k] : undefined);

  const choose = (p) => { setPicked(p); setPickedField(''); setErr(null); };

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ grossKg: true, tareKg: true });
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post('/collections', {
        producerId: producer?._id, fieldId: fieldId || undefined, grossKg: toPayload(gross), tareKg: toPayload(tare),
      });
      navigate(`/collections/${data.id}/receipt`, { state: { receipt: data, justCreated: true } });
    } catch (e2) {
      setErr(apiError(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="weigh" style={{ margin: '0 auto' }}>
      <PageHeader breadcrumb={<><Link to="/collections">Collections</Link> / Weigh &amp; record</>} title="Weigh & record" subtitle="Record a green-leaf collection at the centre." />
      <form className="stack" onSubmit={submit} noValidate>
        {err && !Object.keys(err.fields).length && <Alert>{err.message}</Alert>}
        {err?.code === 'PRODUCER_NOT_VERIFIED' && <Alert>{err.message}</Alert>}

        <div className="card card-body form">
          <h2>1. Producer</h2>
          {producer ? (
            <div className="selected-producer">
              <div>
                <div style={{ fontWeight: 600 }}>{producer.fullName}</div>
                <div className="small muted">{producer.code} · {TYPE_LABEL[producer.type]} {producer.centre?.name ? `· ${producer.centre.name}` : ''}</div>
              </div>
              <button type="button" className="btn secondary sm" onClick={() => choose(null)}>Change</button>
            </div>
          ) : <ProducerPicker onPick={choose} />}
          <FieldError>{err?.fields.producerId}</FieldError>
        </div>

        <div className="card card-body form">
          <h2>2. Field</h2>
          {!producer && <div className="muted small">Choose a producer first.</div>}
          {producer && fields.loading && <div className="muted small">Loading fields…</div>}
          {producer && fields.data && activeFields.length === 0 && <Alert tone="warning">This producer has no active fields.</Alert>}
          {activeFields.length > 0 && (
            <div className="field-tiles" role="radiogroup" aria-label="Field">
              {activeFields.map((f) => (
                <button key={f._id} type="button" role="radio" aria-checked={fieldId === f._id}
                  className={`field-tile ${fieldId === f._id ? 'on' : ''}`} onClick={() => setPickedField(f._id)}>
                  <div className="mono" style={{ fontWeight: 600 }}>{f.code}</div>
                  <div className="small muted">{f.division || '—'} · {f.areaHa} ha</div>
                </button>
              ))}
            </div>
          )}
          <FieldError>{err?.fields.fieldId}</FieldError>
        </div>

        <div className="card card-body form">
          <h2>3. Weights</h2>
          <div className="form-grid">
            <FormField label="Gross weight (kg)" htmlFor="gross" error={fieldError('grossKg')} hint="Leaf + bags, from the scale">
              <input id="gross" className={`input weight-input ${fieldError('grossKg') ? 'invalid' : ''}`} inputMode="decimal" autoComplete="off"
                value={gross} placeholder="0.0" onChange={(e) => { setGross(e.target.value); setErr(null); }}
                onBlur={() => setTouched((t) => ({ ...t, grossKg: true }))} />
            </FormField>
            <FormField label="Tare weight (kg)" htmlFor="tare" error={fieldError('tareKg')} hint="Empty bags / containers">
              <input id="tare" className={`input weight-input ${fieldError('tareKg') ? 'invalid' : ''}`} inputMode="decimal" autoComplete="off"
                value={tare} placeholder="0.0" onChange={(e) => { setTare(e.target.value); setErr(null); }}
                onBlur={() => setTouched((t) => ({ ...t, tareKg: true }))} />
            </FormField>
          </div>
          <div className={`net-display ${(local.grossKg || local.tareKg) && gross && tare ? 'bad' : ''}`} aria-live="polite">
            <div>
              <div style={{ fontWeight: 600 }}>Net weight</div>
              <div className="small">gross − tare, calculated by the system</div>
            </div>
            <div className="big">{net === null ? '—' : net.toFixed(1)} <span style={{ fontSize: 18 }}>kg</span></div>
          </div>
        </div>

        <button className="btn lg block" type="submit" disabled={busy || !producer}>
          {busy ? 'Saving…' : <><Icon name="check" size={18} /> Save &amp; issue receipt</>}
        </button>
      </form>
    </div>
  );
}

function ProducerPicker({ onPick }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const { data, loading } = useFetch('/producers', { q: query || undefined, limit: 8 });
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="search" style={{ maxWidth: 'none' }}>
        <Icon name="search" size={16} />
        <input className="input" placeholder="Search name, PRD code or NIC" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search producer" autoFocus />
      </div>
      <div className="pick-list">
        {loading && !data && <div className="muted small" style={{ padding: 12 }}>Searching…</div>}
        {data?.items.length === 0 && <div className="muted small" style={{ padding: 12 }}>No producers match “{query}”.</div>}
        {data?.items.map((p) => {
          const ok = p.verificationStatus === 'VERIFIED';
          return (
            <button key={p._id} type="button" disabled={!ok} onClick={() => onPick(p)}
              title={ok ? undefined : 'Only verified producers can supply leaf'}>
              <span>
                <span style={{ fontWeight: 500 }}>{p.fullName}</span>
                <span className="small muted" style={{ display: 'block' }}>{p.code} · {p.centre?.name}</span>
              </span>
              {!ok && <StatusBadge status={p.verificationStatus} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
