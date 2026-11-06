import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiError } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { Alert, FieldError, FormField, PageHeader } from '../components/ui.jsx';
import { TYPE_LABEL } from '../components/format.js';
import Icon from '../components/Icon.jsx';

const emptyField = () => ({ division: '', areaHa: '', variety: '' });

/** W05 Register Producer — new producers start as PENDING until Management verifies them. */
export default function RegisterProducer() {
  const navigate = useNavigate();
  const { data: lookups } = useFetch('/lookups');
  const [form, setForm] = useState({ type: 'SMALLHOLDER', fullName: '', nicOrRegNo: '', phone: '', address: '', centreId: '', orgId: '' });
  const [fields, setFields] = useState([emptyField()]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fe = (k) => err?.fields[k];
  const cls = (k) => `input ${fe(k) ? 'invalid' : ''}`;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const body = {
      ...form,
      orgId: form.type === 'ORG_MEMBER' ? form.orgId : undefined,
      fields: fields.filter((f) => f.division || f.areaHa || f.variety)
        .map((f) => ({ ...f, areaHa: f.areaHa === '' ? undefined : Number(f.areaHa) })),
    };
    try {
      const { data } = await api.post('/producers', body);
      navigate(`/producers/${data._id}`, { replace: true, state: { created: true } });
    } catch (e2) {
      setErr(apiError(e2));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader breadcrumb={<><Link to="/producers">Producers</Link> / Register</>} title="Register producer"
        subtitle="The producer will be PENDING until Management verifies the documents." />
      <form className="stack" onSubmit={submit} noValidate style={{ maxWidth: 820 }}>
        {err && <Alert>{Object.keys(err.fields).length ? 'Please correct the highlighted fields.' : err.message}</Alert>}
        <div className="card card-body form">
          <h2>Producer details</h2>
          <FormField label="Producer type" error={fe('type')}>
            <div className="seg">
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <button key={v} type="button" className={form.type === v ? 'on' : ''} onClick={() => setForm({ ...form, type: v })}>{l}</button>
              ))}
            </div>
          </FormField>
          <div className="form-grid">
            <FormField label={form.type === 'ESTATE' ? 'Estate / company name' : 'Full name'} htmlFor="fullName" error={fe('fullName')}>
              <input id="fullName" className={cls('fullName')} value={form.fullName} onChange={set('fullName')} />
            </FormField>
            <FormField label={form.type === 'ESTATE' ? 'Company registration no.' : 'NIC number'} htmlFor="nic" error={fe('nicOrRegNo')}
              hint={form.type === 'ESTATE' ? 'e.g. PV-00219' : 'Old (851234567V) or new (198512345678) format'}>
              <input id="nic" className={cls('nicOrRegNo')} value={form.nicOrRegNo} onChange={set('nicOrRegNo')} />
            </FormField>
            <FormField label="Phone" htmlFor="phone" error={fe('phone')}>
              <input id="phone" className={cls('phone')} inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="0771234567" />
            </FormField>
            <FormField label="Collection centre" htmlFor="centre" error={fe('centreId')}>
              <select id="centre" className={cls('centreId')} value={form.centreId} onChange={set('centreId')}>
                <option value="">Select a centre…</option>
                {lookups?.centres.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.district})</option>)}
              </select>
            </FormField>
            {form.type === 'ORG_MEMBER' && (
              <FormField label="Producer organisation" htmlFor="org" error={fe('orgId')}>
                <select id="org" className={cls('orgId')} value={form.orgId} onChange={set('orgId')}>
                  <option value="">Select an organisation…</option>
                  {lookups?.orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
                </select>
              </FormField>
            )}
          </div>
          <FormField label="Address" htmlFor="address" error={fe('address')}>
            <textarea id="address" className={cls('address')} value={form.address} onChange={set('address')} />
          </FormField>
        </div>

        <div className="card card-body form">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>Fields</h2>
            <button type="button" className="btn secondary sm" onClick={() => setFields([...fields, emptyField()])}><Icon name="plus" size={14} /> Add field</button>
          </div>
          {fields.map((f, i) => {
            const upd = (k) => (e) => setFields(fields.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
            return (
              <div key={i} className="form-grid" style={{ gridTemplateColumns: '1fr 120px 1fr auto', alignItems: 'start' }}>
                <FormField label={i === 0 ? 'Division' : undefined} error={fe(`fields.${i}.division`)}>
                  <input className="input" value={f.division} onChange={upd('division')} placeholder="e.g. Upper slope" aria-label="Division" />
                </FormField>
                <FormField label={i === 0 ? 'Area (ha)' : undefined} error={fe(`fields.${i}.areaHa`)}>
                  <input className={`input ${fe(`fields.${i}.areaHa`) ? 'invalid' : ''}`} inputMode="decimal" value={f.areaHa} onChange={upd('areaHa')} aria-label="Area in hectares" />
                </FormField>
                <FormField label={i === 0 ? 'Variety' : undefined} error={fe(`fields.${i}.variety`)}>
                  <input className="input" value={f.variety} onChange={upd('variety')} placeholder="e.g. TRI 2025" aria-label="Variety" />
                </FormField>
                <button type="button" className="icon-btn" style={{ marginTop: i === 0 ? 26 : 4 }} aria-label="Remove field"
                  onClick={() => setFields(fields.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
              </div>
            );
          })}
          <FieldError>{fe('fields')}</FieldError>
          <div className="muted small">Field codes (e.g. F-00423-A) are assigned automatically.</div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Link className="btn secondary" to="/producers">Cancel</Link>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Register producer'}</button>
        </div>
      </form>
    </>
  );
}
