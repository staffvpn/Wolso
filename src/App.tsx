import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OfflineBanner } from './components/OfflineBanner';
import { PaywallSheet } from './components/PaywallSheet';
import { useAppStore } from './store/useAppStore';
import { RequireOnboarded } from './components/nav/RequireOnboarded';
import { TabShell } from './components/nav/TabShell';

import { Welcome } from './screens/onboarding/Welcome';

import { Feed } from './screens/worker/Feed';
import { FeedMap } from './screens/worker/FeedMap';
import { Responses } from './screens/worker/Responses';
import { Shifts } from './screens/worker/Shifts';
import { ShiftCheckout } from './screens/worker/ShiftCheckout';
import { WorkerProfileScreen } from './screens/worker/Profile';
import { Wallet } from './screens/worker/Wallet';
import { Documents } from './screens/worker/Documents';
import { Settings } from './screens/worker/Settings';
import { Favorites } from './screens/worker/Favorites';

import { Candidates } from './screens/employer/Candidates';
import { Vacancies } from './screens/employer/Vacancies';
import { VacancyDetail } from './screens/employer/VacancyDetail';
import { NewVacancy } from './screens/employer/NewVacancy';
import { EmployerProfileScreen } from './screens/employer/Profile';

import { ChatList } from './screens/shared/ChatList';
import { ChatDetail } from './screens/shared/ChatDetail';
import { Notifications } from './screens/shared/Notifications';

function HomeRedirect() {
  const onboarded = useAppStore((s) => s.onboarded);
  const role = useAppStore((s) => s.role);
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <Navigate to={role === 'worker' ? '/w/feed' : '/e/candidates'} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <div className="relative flex flex-col h-full min-h-0">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/onboarding" element={<Welcome />} />

          <Route element={<RequireOnboarded />}>
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
            <Route path="/w/documents" element={<Documents />} />
            <Route path="/w/settings" element={<Settings />} />
            <Route path="/w/favorites" element={<Favorites />} />
            <Route path="/w/notifications" element={<Notifications />} />

            {/* Employer tabs */}
            <Route path="/e" element={<TabShell />}>
              <Route index element={<Navigate to="candidates" replace />} />
              <Route path="candidates" element={<Candidates />} />
              <Route path="vacancies" element={<Vacancies />} />
              <Route path="chats" element={<ChatList />} />
              <Route path="profile" element={<EmployerProfileScreen />} />
            </Route>
            {/* Employer pushed screens */}
            <Route path="/e/vacancies/new" element={<NewVacancy />} />
            <Route path="/e/vacancies/:vacancyId" element={<VacancyDetail />} />
            <Route path="/e/chats/:chatId" element={<ChatDetail />} />
            <Route path="/e/notifications" element={<Notifications />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <OfflineBanner />
        <PaywallSheet />
      </div>
    </HashRouter>
  );
}
