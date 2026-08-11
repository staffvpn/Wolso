import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
