import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, apiError } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { Alert, FormField, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { dateTime } from '../components/format.js';

/** Users & Roles (ADM): create users, assign roles, deactivate/reactivate. */
export default function Users() {
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useFetch('/users');
  const { data: lookups } = useFetch('/lookups');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const toggle = async (u) => {
    setMsg(null);
    try {
      await api.patch(`/users/${u._id}`, { status: u.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE' });
      reload();
    } catch (e) { setMsg(apiError(e).message); }
  };

  return (
    <>
      <PageHeader title="Users & roles" subtitle="Create accounts, assign roles and deactivate users. A user can hold several roles."
        actions={!creating && <button type="button" className="btn" onClick={() => { setCreating(true); setEditing(null); }}><Icon name="plus" size={16} /> New user</button>} />
      {msg && <div style={{ marginBottom: 16 }}><Alert>{msg}</Alert></div>}
      {creating && <UserForm roles={lookups?.roles ?? []} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
      <div className="card">
        {loading && <Loading />}
        {error && <div className="card-body"><Alert>{error.message}</Alert></div>}
        {data && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  editing === u._id ? (
                    <tr key={u._id}><td colSpan={6} style={{ padding: 0 }}>
                      <UserForm roles={lookups?.roles ?? []} user={u} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
                    </td></tr>
                  ) : (
                    <tr key={u._id}>
                      <td style={{ fontWeight: 500 }}>{u.fullName}</td>
                      <td className="small">{u.email}</td>
                      <td><div className="row" style={{ gap: 4 }}>{u.roles.map((r) => <span key={r} className="badge info">{r}</span>)}</div></td>
                      <td>
                        <StatusBadge status={u.status} />
                        {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <span className="badge warning" style={{ marginLeft: 4 }}>Locked</span>}
                      </td>
                      <td className="small nowrap">{dateTime(u.lastLoginAt)}</td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn secondary sm" onClick={() => { setEditing(u._id); setCreating(false); }}>Edit</button>
                          {u._id !== me.id && (
                            <button type="button" className={`btn sm ${u.status === 'ACTIVE' ? 'danger' : 'secondary'}`} onClick={() => toggle(u)}>
                              {u.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function UserForm({ roles, user, onCancel, onSaved }) {
  const [f, setF] = useState({ fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', password: '', roles: user?.roles ?? [] });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleRole = (r) => setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (user) {
        const body = { fullName: f.fullName, phone: f.phone, roles: f.roles };
        if (f.password) body.password = f.password;
        await api.patch(`/users/${user._id}`, body);
      } else {
        await api.post('/users', f);
      }
      onSaved();
    } catch (e2) { setErr(apiError(e2)); } finally { setBusy(false); }
  };
  const fe = (k) => err?.fields[k];
  return (
    <form className="card card-body form" style={{ marginBottom: user ? 0 : 16 }} onSubmit={submit} noValidate>
      <h2>{user ? `Edit ${user.fullName}` : 'New user'}</h2>
      {err && !Object.keys(err.fields).length && <Alert>{err.message}</Alert>}
      <div className="form-grid">
        <FormField label="Full name" error={fe('fullName')}><input className={`input ${fe('fullName') ? 'invalid' : ''}`} value={f.fullName} onChange={set('fullName')} /></FormField>
        <FormField label="Email" error={fe('email')}><input className={`input ${fe('email') ? 'invalid' : ''}`} type="email" value={f.email} onChange={set('email')} disabled={!!user} /></FormField>
        <FormField label="Phone" error={fe('phone')}><input className={`input ${fe('phone') ? 'invalid' : ''}`} value={f.phone} onChange={set('phone')} /></FormField>
        <FormField label={user ? 'New password (optional)' : 'Password'} error={fe('password')} hint="At least 8 characters with upper case, lower case and a number">
          <input className={`input ${fe('password') ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
        </FormField>
      </div>
      <FormField label="Roles" error={fe('roles')}>
        <div className="checks">
          {roles.map((r) => (
            <label key={r.code} className="check">
              <input type="checkbox" checked={f.roles.includes(r.code)} onChange={() => toggleRole(r.code)} /> <strong>{r.code}</strong> {r.name}
            </label>
          ))}
        </div>
      </FormField>
      <div className="row"><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
    </form>
  );
}
