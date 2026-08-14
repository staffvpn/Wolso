import { Clock3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';

/** Shown once the employer's profile is complete but not yet approved by
 *  an admin — see EmployerVerificationGate in AuthGate.tsx. Nothing to do
 *  here but wait; publishing vacancies and browsing candidates both stay
 *  blocked (server-enforced too — see requireVerifiedCompany) until an
 *  admin approves the profile in the dashboard. */
export function EmployerVerificationPending() {
  return (
    <div className="flex flex-col h-full min-h-0 px-6 safe-top safe-bottom">
      <div className="flex items-center gap-2 pt-5 pb-1 shrink-0">
        <Logo size={20} className="text-accent" />
        <span className="font-extrabold tracking-tight text-[14px]">WOLSO</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          className="h-16 w-16 rounded-full bg-accent-soft text-accent flex items-center justify-center"
        >
          <Clock3 size={28} />
        </motion.div>
        <div>
          <h1 className="text-[20px] font-extrabold leading-tight">Анкета на проверке</h1>
          <p className="text-[14px] text-text-muted mt-2 leading-relaxed max-w-[300px]">
            Мы проверяем данные о вашей компании — это обычно занимает немного времени. Как только всё будет готово,
            вы сможете публиковать вакансии и смотреть анкеты соискателей. Мы пришлём уведомление в этот чат.
          </p>
        </div>
      </div>
    </div>
  );
}
