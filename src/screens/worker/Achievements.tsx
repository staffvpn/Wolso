import { useNavigate } from 'react-router-dom';
import { Award } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

/** Экран уже на своём месте в профиле, но система бейджей (правила,
 *  ручная выдача из админки, хранение прогресса) ещё не сделана — сюда
 *  зайдёт настоящий список, когда бэкенд будет готов. До этого честнее
 *  показать «скоро», чем рисовать чужие достижения на реальном профиле. */
export function Achievements() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Достижения" onBack={() => navigate(-1)} />
      <div className="flex-1 min-h-0 overflow-y-auto px-5">
        <EmptyState
          icon={<Award size={26} />}
          title="Скоро"
          description="Бейджи за смены, рейтинг и стаж появятся здесь в одном из следующих обновлений."
        />
      </div>
    </div>
  );
}
