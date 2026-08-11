import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { TabFade } from '../PageTransition';

export function TabShell() {
  const location = useLocation();
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TabFade key={location.pathname}>
          <Outlet />
        </TabFade>
      </div>
      <BottomNav />
    </div>
  );
}
