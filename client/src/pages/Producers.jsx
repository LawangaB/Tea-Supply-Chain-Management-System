import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../api/useFetch.js';
import { Alert, Empty, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import { TYPE_LABEL } from '../components/format.js';
import Icon from '../components/Icon.jsx';
import { date } from '../components/format.js';

const TABS = [['', 'All'], ['PENDING', 'Pending'], ['VERIFIED', 'Verified'], ['REJECTED', 'Rejected']];

/** W03 Producer Registry */
export default function Producers() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [query, setQuery] = useState(q);
  const [page, setPage] = useState(1);

  useEffect(() => { // debounce search typing
    const t = setTimeout(() => { setQuery(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading } = useFetch('/producers', { q: query || undefined, status: status || undefined, page, limit: 20 });
  const setStatus = (s) => { setPage(1); setParams(s ? { status: s } : {}); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader title="Producers" subtitle="Smallholders, estates and producer-organisation members supplying green leaf."
        actions={can('producer:create') && <Link className="btn" to="/producers/new"><Icon name="plus" size={16} /> Register producer</Link>} />
      <div className="card">
        <div className="card-header">
          <div className="search">
            <Icon name="search" size={16} />
            <input className="input" placeholder="Search by name, code, NIC or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search producers" />
          </div>
          <div className="seg" role="tablist">
            {TABS.map(([v, label]) => (
              <button key={v} type="button" className={status === v ? 'on' : ''} onClick={() => setStatus(v)} role="tab" aria-selected={status === v}>{label}</button>
            ))}
          </div>
        </div>
        {loading && <Loading />}
        {error && <div className="card-body"><Alert>{error.message}</Alert></div>}
        {data && data.items.length === 0 && <Empty icon="producers" title="No producers found">Try a different search or filter.</Empty>}
        {data && data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Centre</th><th>NIC / Reg. no.</th><th>Registered</th><th>Status</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id} className="clickable" onClick={() => navigate(`/producers/${p._id}`)}>
                    <td className="mono"><Link to={`/producers/${p._id}`} onClick={(e) => e.stopPropagation()}>{p.code}</Link></td>
                    <td style={{ fontWeight: 500 }}>{p.fullName}</td>
                    <td>{TYPE_LABEL[p.type]}</td>
                    <td>{p.centre?.name}</td>
                    <td className="mono small">{p.nicOrRegNo}</td>
                    <td className="nowrap">{date(p.createdAt)}</td>
                    <td><StatusBadge status={p.verificationStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.limit && (
          <div className="card-header" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            <span className="muted small">{data.total} producers · page {page} of {pages}</span>
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
