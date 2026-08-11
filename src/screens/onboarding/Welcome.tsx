import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Illustration } from '@/components/Illustration';
import { useAppStore } from '@/store/useAppStore';
import type { Role } from '@/types';

export function Welcome() {
  const navigate = useNavigate();
  const setOnboarded = useAppStore((s) => s.setOnboarded);

  function choose(role: Role) {
    setOnboarded(role);
    navigate(role === 'worker' ? '/w/feed' : '/e/candidates', { replace: true });
  }

  return (
    <div className="flex flex-col h-full px-6 pt-6 safe-top safe-bottom">
      <div className="flex items-center gap-2">
        <Logo size={22} className="text-accent" />
        <span className="font-extrabold tracking-tight text-[15px]">WOLSO</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="mt-8"
      >
        <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-tight">
          Смена на сегодня —<br />
          в один <span className="text-accent">свайп</span>
        </h1>
        <p className="text-[15px] text-text-muted mt-3 leading-relaxed max-w-[320px]">
          Листайте смены рядом с вами. Понравилась — свайп вправо, менеджер ответит в Telegram.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="flex-1 min-h-[220px] my-6"
      >
        <Illustration caption="иллюстрация" hint="повар и стопка карточек" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="flex flex-col gap-3 pb-4"
      >
        <Button fullWidth onClick={() => choose('worker')}>
          Я ищу смены
        </Button>
        <Button fullWidth variant="dark" onClick={() => choose('employer')}>
          Я ищу сотрудников
        </Button>
        <p className="text-center text-[12px] text-text-faint mt-1">Вход через Telegram · без пароля</p>
      </motion.div>
    </div>
  );
}
