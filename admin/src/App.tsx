import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RequireNavAccess } from './components/layout/RequireNavAccess';
import { AuthGate } from './components/AuthGate';

import { Dashboard } from './screens/Dashboard';
import { Users } from './screens/Users';
import { Vacancies } from './screens/Vacancies';
import { Verification } from './screens/Verification';
import { Finance } from './screens/Finance';
import { Roles } from './screens/Roles';
import { AuditLog } from './screens/AuditLog';
import { Settings } from './screens/Settings';
import { Support } from './screens/Support';
import { DataManagement } from './screens/DataManagement';

export default function App() {
  return (
    <HashRouter>
      <AuthGate>
        <Routes>
          <Route element={<AppShell />}>
            <Route element={<RequireNavAccess />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/vacancies" element={<Vacancies />} />
              <Route path="/verification" element={<Verification />} />
              <Route path="/support" element={<Support />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/roles" element={<Roles />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/data" element={<DataManagement />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </HashRouter>
  );
}
