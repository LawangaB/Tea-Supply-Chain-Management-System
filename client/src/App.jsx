import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { ProtectedRoute, RequirePermission } from './auth/guards.jsx';
import AppLayout from './layout/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Producers from './pages/Producers.jsx';
import ProducerProfile from './pages/ProducerProfile.jsx';
import RegisterProducer from './pages/RegisterProducer.jsx';
import Collections from './pages/Collections.jsx';
import RecordCollection from './pages/RecordCollection.jsx';
import Receipt from './pages/Receipt.jsx';
import Users from './pages/Users.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import Forbidden from './pages/Forbidden.jsx';
import NotFound from './pages/NotFound.jsx';

/** Placeholder modules come from the server menu (GET /auth/me), so access follows the same matrix. */
function Placeholder() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const item = session?.menu?.find((m) => m.path === pathname && m.comingInSprint);
  return item ? <ComingSoon title={item.label} sprint={item.comingInSprint} /> : <Forbidden />;
}

const PLACEHOLDER_PATHS = ['leaf-quality', 'processing', 'finished-quality', 'traceability', 'inventory', 'orders',
  'buyers', 'pricing', 'payments', 'transport', 'reports'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="producers" element={<RequirePermission action="producer:read"><Producers /></RequirePermission>} />
              <Route path="producers/new" element={<RequirePermission action="producer:create"><RegisterProducer /></RequirePermission>} />
              <Route path="producers/:id" element={<RequirePermission action="producer:read"><ProducerProfile /></RequirePermission>} />
              <Route path="collections" element={<RequirePermission action="collection:read"><Collections /></RequirePermission>} />
              <Route path="collections/new" element={<RequirePermission action="collection:create"><RecordCollection /></RequirePermission>} />
              <Route path="collections/:id/receipt" element={<RequirePermission action="receipt:read"><Receipt /></RequirePermission>} />
              <Route path="users" element={<RequirePermission action="user:read"><Users /></RequirePermission>} />
              {PLACEHOLDER_PATHS.map((p) => <Route key={p} path={p} element={<Placeholder />} />)}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
