import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../api/useFetch.js';
import { Alert, Empty, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { dateTime, kg } from '../components/format.js';

export default function Collections() {
  const { can, session } = useAuth();
  const [range, setRange] = useState('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const { data, error, loading } = useFetch('/collections', {
    q: query || undefined, today: range === 'today' ? true : undefined, page, limit: 25,
  });
  const showBatch = can('batch:read');
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const isFarmer = !!session.producer && !can('collection:create') && !can('dashboard:read');

  return (
    <>
      <PageHeader title={isFarmer ? 'My leaf deliveries' : 'Collections'}
        subtitle={isFarmer ? 'Green leaf you have supplied, with receipts.' : 'Green-leaf collections recorded at the centres.'}
        actions={can('collection:create') && <Link className="btn" to="/collections/new"><Icon name="plus" size={16} /> Record collection</Link>} />
      <div className="card">
        <div className="card-header">
          {!isFarmer && (
            <div className="search">
              <Icon name="search" size={16} />
              <input className="input" placeholder="Receipt no., producer name or code" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search collections" />
            </div>
          )}
          <div className="seg">
            <button type="button" className={range === 'all' ? 'on' : ''} onClick={() => { setRange('all'); setPage(1); }}>All</button>
            <button type="button" className={range === 'today' ? 'on' : ''} onClick={() => { setRange('today'); setPage(1); }}>Today</button>
          </div>
          {data && <span className="muted small">{data.total} collections · {kg(data.totalNetKg)} net</span>}
        </div>
        {loading && <Loading />}
        {error && <div className="card-body"><Alert>{error.message}</Alert></div>}
        {data && data.items.length === 0 && <Empty icon="collections" title="No collections found" />}
        {data && data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt</th><th>Date &amp; time</th><th>Producer</th><th>Field</th>
                  <th className="num">Gross</th><th className="num">Tare</th><th className="num">Net</th>
                  {showBatch && <th>Batch ID</th>}{showBatch && <th>Status</th>}<th>Collector</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="mono small">{can('receipt:read') ? <Link to={`/collections/${c.id}/receipt`}>{c.receiptNo}</Link> : c.receiptNo}</td>
                    <td className="nowrap">{dateTime(c.collectedAt)}</td>
                    <td><div style={{ fontWeight: 500 }}>{c.producer?.fullName}</div><div className="muted small">{c.producer?.code}</div></td>
                    <td className="mono small">{c.field?.code}</td>
                    <td className="num">{kg(c.grossKg)}</td>
                    <td className="num">{kg(c.tareKg)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{kg(c.netKg)}</td>
                    {showBatch && <td className="mono small nowrap">{c.batchCode}</td>}
                    {showBatch && <td><StatusBadge status={c.batchStatus} /></td>}
                    <td className="small">{c.collector?.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.limit && (
          <div className="card-header" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            <span className="muted small">Page {page} of {pages}</span>
            <div className="row">
              <button type="button" className="btn secondary sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button type="button" className="btn secondary sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
