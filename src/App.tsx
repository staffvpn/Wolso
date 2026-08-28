import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OfflineBanner } from './components/OfflineBanner';
import { PaywallSheet } from './components/PaywallSheet';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './store/useAuthStore';
import { TabShell } from './components/nav/TabShell';

import { Feed } from './screens/worker/Feed';
import { FeedMap } from './screens/worker/FeedMap';
import { Responses } from './screens/worker/Responses';
import { Shifts } from './screens/worker/Shifts';
import { ShiftCheckout } from './screens/worker/ShiftCheckout';
import { WorkerProfileScreen } from './screens/worker/Profile';
import { Wallet } from './screens/worker/Wallet';
import { Settings } from './screens/worker/Settings';
import { Favorites } from './screens/worker/Favorites';

import { Candidates } from './screens/employer/Candidates';
import { FindWorkers } from './screens/employer/FindWorkers';
import { Vacancies } from './screens/employer/Vacancies';
import { VacancyDetail } from './screens/employer/VacancyDetail';
import { NewVacancy } from './screens/employer/NewVacancy';
import { EmployerProfileScreen } from './screens/employer/Profile';

import { ChatList } from './screens/shared/ChatList';
import { ChatDetail } from './screens/shared/ChatDetail';
import { Notifications } from './screens/shared/Notifications';
import { Support } from './screens/shared/Support';
import { Reviews } from './screens/shared/Reviews';
import { CompleteWorkerProfile } from './screens/onboarding/CompleteWorkerProfile';
import { CompleteEmployerProfile } from './screens/onboarding/CompleteEmployerProfile';

function HomeRedirect() {
  const role = useAuthStore((s) => s.role);
  return <Navigate to={role === 'employer' ? '/e/candidates' : '/w/feed'} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <div className="relative flex flex-col h-full min-h-0">
        <ErrorBoundary>
          <AuthGate>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />

              {/* Worker tabs */}
              <Route path="/w" element={<TabShell />}>
                <Route index element={<Navigate to="feed" replace />} />
                <Route path="feed" element={<Feed />} />
                <Route path="responses" element={<Responses />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="chats" element={<ChatList />} />
                <Route path="profile" element={<WorkerProfileScreen />} />
              </Route>
              {/* Worker pushed screens */}
              <Route path="/w/map" element={<FeedMap />} />
              <Route path="/w/chats/:chatId" element={<ChatDetail />} />
              <Route path="/w/checkout/:applicationId" element={<ShiftCheckout />} />
              <Route path="/w/wallet" element={<Wallet />} />
              <Route path="/w/settings" element={<Settings />} />
              <Route path="/w/favorites" element={<Favorites />} />
              <Route path="/w/notifications" element={<Notifications />} />
              <Route path="/w/support" element={<Support />} />
              <Route path="/w/profile/edit" element={<CompleteWorkerProfile />} />
              <Route path="/w/reviews" element={<Reviews role="worker" />} />

              {/* Employer tabs */}
              <Route path="/e" element={<TabShell />}>
                <Route index element={<Navigate to="candidates" replace />} />
                <Route path="find" element={<FindWorkers />} />
                <Route path="candidates" element={<Candidates />} />
                <Route path="vacancies" element={<Vacancies />} />
                <Route path="chats" element={<ChatList />} />
                <Route path="profile" element={<EmployerProfileScreen />} />
              </Route>
              {/* Employer pushed screens */}
              <Route path="/e/vacancies/new" element={<NewVacancy />} />
              {/* Same form, loaded with an existing posting's values. */}
              <Route path="/e/vacancies/:vacancyId/edit" element={<NewVacancy />} />
              <Route path="/e/vacancies/:vacancyId" element={<VacancyDetail />} />
              <Route path="/e/chats/:chatId" element={<ChatDetail />} />
              <Route path="/e/notifications" element={<Notifications />} />
              <Route path="/e/support" element={<Support />} />
              <Route path="/e/profile/edit" element={<CompleteEmployerProfile />} />
              <Route path="/e/reviews" element={<Reviews role="employer" />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <OfflineBanner />
            <PaywallSheet />
          </AuthGate>
        </ErrorBoundary>
      </div>
    </HashRouter>
  );
}
