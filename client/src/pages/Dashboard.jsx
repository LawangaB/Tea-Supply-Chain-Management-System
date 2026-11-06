import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../api/useFetch.js';
import { Alert, Empty, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { kg, num, time, dateTime, date } from '../components/format.js';

const greeting = () => {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', hour12: false }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** ESPTSCMS-145: role-based landing page. */
export default function Dashboard() {
  const { user, can, session } = useAuth();
  const first = user.fullName.split(' ').slice(-1)[0];
  return (
    <>
      <PageHeader title={`${greeting()}, ${first}`} subtitle={`${user.roleNames.join(' · ')} — ${date(new Date())}`}
        actions={can('collection:create') && (
          <Link className="btn" to="/collections/new"><Icon name="plus" size={16} /> Record collection</Link>
        )} />
      {can('dashboard:read') && <ManagementHome />}
      {!can('dashboard:read') && can('collection:create') && <CollectorHome />}
      {!can('dashboard:read') && !can('collection:create') && session.producer && <FarmerHome producer={session.producer} />}
      {!can('dashboard:read') && !can('collection:create') && !session.producer && can('collection:read') && <RecentBatches />}
      {can('user:read') && <AdminHome />}
      <UpcomingModules />
    </>
  );
}

function Kpi({ label, value, unit, hint, accent }) {
  return (
    <div className={`card kpi ${accent ? 'accent' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}{unit && <small>{unit}</small>}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function ManagementHome() {
  const { data, error, loading } = useFetch('/dashboard/today');
  if (loading) return <Loading />;
  if (error) return <Alert>{error.message}</Alert>;
  const max = Math.max(1, ...data.byCentre.map((c) => c.netKg));
  return (
    <div className="stack">
      <div className="grid kpis">
        <Kpi accent label="Green leaf collected today" value={num(data.totalNetKg)} unit="kg" hint="Net weight, all centres" />
        <Kpi label="Collections today" value={num(data.collectionsCount)} hint={`${data.producersSupplied} producers supplied`} />
        <Kpi label="Producers pending verification" value={num(data.pendingProducers)}
          hint={<Link to="/producers?status=PENDING">Review pending →</Link>} />
        <Kpi label="Verified producers" value={num(data.verifiedProducers)} />
      </div>
      <div className="grid two">
        <div className="card">
          <div className="card-header"><h2>Today&apos;s collections</h2><Link to="/collections">View all</Link></div>
          {data.recent.length === 0 ? <Empty title="No collections yet today" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Time</th><th>Producer</th><th>Batch ID</th><th className="num">Net</th></tr></thead>
                <tbody>
                  {data.recent.map((c) => (
                    <tr key={c.id}>
                      <td className="nowrap">{time(c.collectedAt)}</td>
                      <td><div style={{ fontWeight: 500 }}>{c.producer?.fullName}</div><div className="muted small">{c.producer?.code}</div></td>
                      <td className="mono small">{c.batchCode}</td>
                      <td className="num">{kg(c.netKg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h2>By collection centre</h2></div>
          <div className="card-body stack">
            {data.byCentre.length === 0 && <div className="muted">No leaf received today.</div>}
            {data.byCentre.map((c) => (
              <div key={c.centre}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{c.centre}</span><span className="muted small">{kg(c.netKg)} · {c.count}</span>
                </div>
                <div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${(c.netKg / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectorHome() {
  const { data, loading } = useFetch('/collections', { today: true, mine: true, limit: 10 });
  return (
    <div className="stack">
      <div className="grid kpis">
        <Kpi accent label="My collections today" value={loading ? '…' : num(data?.total)} />
        <Kpi label="Net leaf I collected today" value={loading ? '…' : num(data?.totalNetKg)} unit="kg" />
      </div>
      <div className="card">
        <div className="card-header"><h2>My collections today</h2><Link to="/collections">All collections</Link></div>
        {loading ? <Loading /> : data?.items.length ? (
          <ul className="list">
            {data.items.map((c) => (
              <li key={c.id}>
                <div>
                  <div style={{ fontWeight: 500 }}>{c.producer.fullName} <span className="muted small">{c.producer.code}</span></div>
                  <div className="muted small">{time(c.collectedAt)} · {c.receiptNo} · <span className="mono">{c.batchCode}</span></div>
                </div>
                <div className="row"><strong>{kg(c.netKg)}</strong><Link to={`/collections/${c.id}/receipt`}>Receipt</Link></div>
              </li>
            ))}
          </ul>
        ) : <Empty title="Nothing recorded yet today"><Link to="/collections/new">Record the first collection</Link></Empty>}
      </div>
    </div>
  );
}

function FarmerHome({ producer }) {
  const { data, loading } = useFetch('/collections', { limit: 5 });
  return (
    <div className="grid two">
      <div className="card">
        <div className="card-header"><h2>My recent leaf deliveries</h2><Link to="/collections">View all</Link></div>
        {loading ? <Loading /> : data?.items.length ? (
          <ul className="list">
            {data.items.map((c) => (
              <li key={c.id}>
                <div>
                  <div style={{ fontWeight: 500 }}>{dateTime(c.collectedAt)}</div>
                  <div className="muted small">{c.receiptNo} · Field {c.field.code}</div>
                </div>
                <div className="row"><strong>{kg(c.netKg)}</strong><Link to={`/collections/${c.id}/receipt`}>Receipt</Link></div>
              </li>
            ))}
          </ul>
        ) : <Empty title="No deliveries yet" />}
      </div>
      <div className="card card-body stack">
        <h2>My producer record</h2>
        <div><div style={{ fontWeight: 600 }}>{producer.fullName}</div><div className="muted">{producer.code}</div></div>
        <div className="muted small">Total delivered: <strong>{data ? kg(data.totalNetKg) : '…'}</strong> in {data?.total ?? '…'} collections</div>
        <Link className="btn secondary" to={`/producers/${producer._id}`}>Open my record</Link>
      </div>
    </div>
  );
}

function RecentBatches() {
  const { data, loading } = useFetch('/collections', { limit: 8 });
  return (
    <div className="card">
      <div className="card-header"><h2>Latest green-leaf batches</h2><Link to="/collections">View all</Link></div>
      {loading ? <Loading /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Batch ID</th><th>Received</th><th>Producer</th><th>Status</th><th className="num">Net</th></tr></thead>
            <tbody>
              {data?.items.map((c) => (
                <tr key={c.id}>
                  <td className="mono small">{c.batchCode}</td>
                  <td className="nowrap">{dateTime(c.collectedAt)}</td>
                  <td>{c.producer.fullName}</td>
                  <td><StatusBadge status={c.batchStatus} /></td>
                  <td className="num">{kg(c.netKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminHome() {
  const { data } = useFetch('/users');
  const active = data?.items.filter((u) => u.status === 'ACTIVE').length;
  return (
    <div className="grid kpis" style={{ marginTop: 16 }}>
      <Kpi label="User accounts" value={data ? num(data.total) : '…'} hint={data ? `${active} active` : ''} />
      <div className="card kpi">
        <div className="label">Administration</div>
        <div style={{ marginTop: 10 }}><Link className="btn secondary" to="/users">Manage users &amp; roles</Link></div>
      </div>
    </div>
  );
}

function UpcomingModules() {
  const { session } = useAuth();
  const later = session.menu.filter((m) => m.comingInSprint);
  if (!later.length) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header"><h2>Your upcoming modules</h2></div>
      <div className="card-body row">
        {later.map((m) => (
          <Link key={m.key} to={m.path} className="badge neutral" style={{ padding: '6px 12px' }}>
            {m.label} · Sprint {m.comingInSprint}
          </Link>
        ))}
      </div>
    </div>
  );
}
