import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { navForRole } from './nav';
import { useCurrentRole, useSessionStore } from '@/store/useSessionStore';
import { useModerationStore } from '@/store/useModerationStore';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';

export function Sidebar() {
  const staff = useSessionStore((s) => s.staff);
  const logout = useSessionStore((s) => s.logout);
  const role = useCurrentRole();
  const items = navForRole(role);
  const moderationCount = useModerationStore((s) => s.vacancies.length);

  return (
    <aside className="w-[248px] shrink-0 bg-sidebar flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 pt-6 pb-6">
        <Logo size={22} className="text-accent" />
        <span className="font-extrabold tracking-tight text-[15px] text-sidebar-text">WOLSO</span>
        <span className="ml-auto text-[10px] font-bold tracking-wide text-sidebar-text-muted border border-white/15 rounded px-1.5 py-0.5">
          ADMIN
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 h-11 rounded-xl text-[14px] font-medium transition-colors',
                isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text',
              )
            }
          >
            <item.icon size={17} strokeWidth={2} className="shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.to === '/moderation' && moderationCount > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {moderationCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 px-3 pb-4 pt-2 border-t border-white/8 mt-2">
        <Avatar name={staff?.name ?? '?'} size={32} />
        <div className="min-w-0 text-left flex-1">
          <p className="text-[13px] font-semibold text-sidebar-text truncate">{staff?.name?.split(' ')[0]}</p>
          <p className="text-[12px] text-sidebar-text-muted truncate">{role.name}</p>
        </div>
        <button
          onClick={logout}
          aria-label="Выйти"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors shrink-0"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
