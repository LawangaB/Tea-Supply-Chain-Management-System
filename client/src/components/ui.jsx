/* Small shared UI pieces. */
import Icon from './Icon.jsx';

export function Loading() {
  return <div className="loading"><div className="spinner" aria-label="Loading" /></div>;
}

export function PageHeader({ title, subtitle, breadcrumb, actions }) {
  return (
    <div className="page-header">
      <div>
        {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

const STATUS_TONE = {
  VERIFIED: 'success', ACTIVE: 'success', ACCEPTED: 'success',
  PENDING: 'warning', IN_TRANSIT: 'info', RECEIVED: 'info',
  REJECTED: 'danger', DEACTIVATED: 'danger',
};
const pretty = (s) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge ${STATUS_TONE[status] || 'neutral'}`}>{pretty(status)}</span>;
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function FieldError({ children }) {
  return children ? <div className="field-error" role="alert">{children}</div> : null;
}

/** Labelled input with an API field error underneath. */
export function FormField({ label, error, hint, htmlFor, children }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && !error && <div className="hint">{hint}</div>}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Alert({ tone = 'error', children }) {
  return children ? <div className={`alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div> : null;
}

export function Empty({ icon = 'leaf', title, children }) {
  return (
    <div className="empty">
      <div className="big-icon"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

