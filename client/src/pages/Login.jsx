import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { apiError } from '../api/client.js';
import { Alert, FormField } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

// Demo shortcuts are only shown in development builds.
const DEMO = import.meta.env.DEV
  ? ['admin', 'mgt', 'farmer', 'col', 'fac', 'qo', 'wh', 'buyer', 'trn'].map((u) => `${u}@smarttea.lk`)
  : [];

export default function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark"><Icon name="leaf" size={20} /></div>
          <div>
            <div className="brand-name">Smart Tea</div>
            <div className="brand-sub">Supply Chain &amp; Traceability</div>
          </div>
        </div>
        <div>
          <h2>From the bush to the buyer — every kilo accounted for.</h2>
          <p>Register producers, weigh green leaf at the collection centre and trace every batch through the factory.</p>
        </div>
        <div className="small" style={{ color: 'var(--sidebar-text)' }}>EC5406 · Group 13 · Sprint 1 prototype</div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="muted" style={{ marginTop: 6 }}>Use the account given to you by your administrator.</p>
          <form className="form card card-body" style={{ marginTop: 20 }} onSubmit={submit} noValidate>
            <Alert>{error && !Object.keys(error.fields).length ? error.message : null}</Alert>
            <FormField label="Email" htmlFor="email" error={error?.fields.email}>
              <input id="email" className={`input ${error?.fields.email ? 'invalid' : ''}`} type="email" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </FormField>
            <FormField label="Password" htmlFor="password" error={error?.fields.password}>
              <input id="password" className={`input ${error?.fields.password ? 'invalid' : ''}`} type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <button className="btn lg block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="muted small row" style={{ gap: 6 }}>
              <Icon name="lock" size={14} /> Accounts lock for 15 minutes after 5 failed attempts.
            </div>
          </form>

          {DEMO.length > 0 && (
            <div className="demo-accounts">
              <div style={{ marginBottom: 6 }}>Demo accounts (password <span className="mono">Demo@1234</span>):</div>
              <div className="checks">
                {DEMO.map((d) => (
                  <button key={d} type="button" className="check" onClick={() => { setEmail(d); setPassword('Demo@1234'); }}>
                    {d.split('@')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
