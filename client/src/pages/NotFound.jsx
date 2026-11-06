import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function NotFound() {
  return (
    <div className="card empty" style={{ marginTop: 24 }}>
      <div className="big-icon"><Icon name="search" size={26} /></div>
      <h2>Page not found</h2>
      <p className="muted">The page you are looking for doesn&apos;t exist.</p>
      <Link className="btn secondary" to="/">Back to dashboard</Link>
    </div>
  );
}
