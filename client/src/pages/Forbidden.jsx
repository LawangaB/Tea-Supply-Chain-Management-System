import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function Forbidden() {
  return (
    <div className="card empty" style={{ marginTop: 24 }}>
      <div className="big-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}><Icon name="lock" size={26} /></div>
      <h2>You don&apos;t have access</h2>
      <p className="muted">Your role does not allow you to open this page. Ask your administrator if you think this is wrong.</p>
      <Link className="btn secondary" to="/">Back to dashboard</Link>
    </div>
  );
}
