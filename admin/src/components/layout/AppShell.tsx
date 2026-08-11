import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Logo } from '../ui/Logo';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border-soft shrink-0 bg-bg">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Меню"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2 transition-colors -ml-1.5"
          >
            <Menu size={20} />
          </button>
          <Logo size={20} className="text-accent" />
          <span className="font-extrabold tracking-tight text-[14px]">WOLSO ADMIN</span>
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
