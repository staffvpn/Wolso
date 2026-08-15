import { HashRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PaywallSheet } from './components/PaywallSheet';
import { Home } from './screens/Home';
import { Result, HistoryDetailScreen } from './screens/Result';
import { History } from './screens/History';

export default function App() {
  return (
    <HashRouter>
      <div className="relative flex flex-col h-full min-h-0">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/result" element={<Result />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<HistoryDetailScreen />} />
          </Routes>
          <PaywallSheet />
        </ErrorBoundary>
      </div>
    </HashRouter>
  );
}
