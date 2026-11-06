import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import { initials } from '../components/format.js';

function Sidebar({ open, onClose }) {
  const { session } = useAuth();
  const menu = session?.menu ?? [];
  const live = menu.filter((m) => !m.comingInSprint);
  const later = menu.filter((m) => m.comingInSprint);
  return (
    <>
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark"><Icon name="leaf" size={20} /></div>
          <div>
            <div className="brand-name">Smart Tea</div>
            <div className="brand-sub">Supply Chain &amp; Traceability</div>
          </div>
        </div>
        <nav className="nav">
          {live.map((m) => (
            <NavLink key={m.key} to={m.path} end={m.path === '/'} onClick={onClose}>
              <Icon name={m.key} /> {m.label}
            </NavLink>
          ))}
          {later.length > 0 && <div className="nav-section">Coming soon</div>}
          {later.map((m) => (
            <NavLink key={m.key} to={m.path} onClick={onClose}>
              <Icon name={m.key} /> {m.label} <span className="soon">S{m.comingInSprint}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-chip" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials(user.fullName)}</span>
        <span className="who">
          <div style={{ fontWeight: 600 }}>{user.fullName}</div>
          <div className="muted small">{user.roleNames.join(', ')}</div>
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="info">
            <div style={{ fontWeight: 600 }}>{user.fullName}</div>
            <div className="muted small">{user.email}</div>
            <div className="muted small">Roles: {user.roles.join(', ')}</div>
          </div>
          <button type="button" className="btn ghost sm" onClick={signOut} role="menuitem">
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={22} />
          </button>
          <div className="spacer" />
          <UserMenu />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
