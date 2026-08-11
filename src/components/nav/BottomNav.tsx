import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, ListChecks, CalendarClock, MessageCircle, CircleUserRound, Users, Briefcase } from 'lucide-react';
import { cn } from '@/lib/cn';
import { hapticSelect } from '@/lib/telegram';
import { useChatStore } from '@/store/useChatStore';
import { useRole } from '@/hooks/useRole';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Target;
  badge?: number;
}

export function BottomNav() {
  const role = useRole();
  const unreadChats = useChatStore((s) => s.chats.reduce((sum, c) => sum + c.unread, 0));

  const workerItems: NavItem[] = [
    { to: '/w/feed', label: 'Лента', icon: Target },
    { to: '/w/responses', label: 'Отклики', icon: ListChecks },
    { to: '/w/shifts', label: 'Смены', icon: CalendarClock },
    { to: '/w/chats', label: 'Чаты', icon: MessageCircle, badge: unreadChats },
    { to: '/w/profile', label: 'Профиль', icon: CircleUserRound },
  ];

  const employerItems: NavItem[] = [
    { to: '/e/candidates', label: 'Кандидаты', icon: Users },
    { to: '/e/vacancies', label: 'Вакансии', icon: Briefcase },
    { to: '/e/chats', label: 'Чаты', icon: MessageCircle, badge: unreadChats },
    { to: '/e/profile', label: 'Профиль', icon: CircleUserRound },
  ];

  const items = role === 'worker' ? workerItems : employerItems;

  return (
    <nav className="shrink-0 border-t border-border-soft bg-bg-elevated safe-bottom">
      <div className="flex items-stretch justify-around px-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={hapticSelect}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative"
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    className={cn('transition-colors duration-150', isActive ? 'text-accent' : 'text-text-faint')}
                  />
                  {!!item.badge && (
                    <span className="absolute -top-1 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={cn('text-[11px] font-medium transition-colors duration-150', isActive ? 'text-accent' : 'text-text-faint')}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
