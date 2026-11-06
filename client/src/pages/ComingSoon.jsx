import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { PageHeader } from '../components/ui.jsx';

export default function ComingSoon({ title, sprint }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card empty">
        <div className="big-icon"><Icon name="clock" size={26} /></div>
        <h2>Coming in Sprint {sprint}</h2>
        <p className="muted">This module is planned for a later sprint. It is shown here so you can see where it will live.</p>
        <Link className="btn secondary" to="/">Back to dashboard</Link>
      </div>
    </>
  );
}
