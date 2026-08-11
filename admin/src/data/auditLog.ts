import type { AuditLogEntry } from '@/types';

export const AUDIT_LOG: AuditLogEntry[] = [
  { id: 'log-1', actorName: 'Анна Г.', actorRoleLabel: 'Админ', action: 'изменила комиссию 6% → 7%', minutesAgo: 14, tone: 'accent' },
  { id: 'log-2', actorName: 'Дмитрий М.', actorRoleLabel: 'Модератор', action: 'отклонил вакансию «Официант · Веранда»', minutesAgo: 143, tone: 'danger' },
  { id: 'log-3', actorName: 'Елена В.', actorRoleLabel: 'Owner', action: 'выдала роль «Модератор» Сергею П.', minutesAgo: 1215, tone: 'neutral' },
  { id: 'log-4', actorName: 'Анна Г.', actorRoleLabel: 'Админ', action: 'заблокировала ООО «Кофемолка»', minutesAgo: 3800, tone: 'danger' },
  { id: 'log-5', actorName: 'Дмитрий М.', actorRoleLabel: 'Модератор', action: 'одобрил вакансию «Бариста · Skuratov Coffee»', minutesAgo: 4600, tone: 'neutral' },
  { id: 'log-6', actorName: 'Катя С.', actorRoleLabel: 'Поддержка', action: 'закрыла тикет #4021', minutesAgo: 5200, tone: 'neutral' },
  { id: 'log-7', actorName: 'Елена В.', actorRoleLabel: 'Owner', action: 'провела выплаты на сумму 842 300 ₽', minutesAgo: 5900, tone: 'accent' },
  { id: 'log-8', actorName: 'Анна Г.', actorRoleLabel: 'Админ', action: 'пригласила Олега Данилова в команду', minutesAgo: 7100, tone: 'neutral' },
];
