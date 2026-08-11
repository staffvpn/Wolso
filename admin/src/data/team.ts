import type { TeamMember } from '@/types';

export const TEAM: TeamMember[] = [
  { id: 'u-elena', name: 'Елена Воронина', email: 'elena@stafftap.ru', roleId: 'owner', status: 'active', lastActiveMinAgo: 0, since: 2024 },
  { id: 'u-anna', name: 'Анна Гросс', email: 'anna@stafftap.ru', roleId: 'admin', status: 'active', lastActiveMinAgo: 60, since: 2024 },
  { id: 'u-pavel', name: 'Павел Игнатьев', email: 'pavel@stafftap.ru', roleId: 'admin', status: 'active', lastActiveMinAgo: 200, since: 2025 },
  { id: 'u-dmitry', name: 'Дмитрий Мельник', email: 'dmitry@stafftap.ru', roleId: 'moderator', status: 'active', lastActiveMinAgo: 12, since: 2025 },
  { id: 'u-sergey', name: 'Сергей П.', email: 'sergey@stafftap.ru', roleId: 'moderator', status: 'active', lastActiveMinAgo: 40, since: 2025 },
  { id: 'u-vera', name: 'Вера Носова', email: 'vera@stafftap.ru', roleId: 'moderator', status: 'active', lastActiveMinAgo: 5, since: 2026 },
  { id: 'u-oleg', name: 'Олег Данилов', email: 'oleg@stafftap.ru', roleId: 'moderator', status: 'invited', lastActiveMinAgo: 4320, since: 2026 },
  { id: 'u-katya', name: 'Катя Смирнова', email: 'katya@stafftap.ru', roleId: 'support', status: 'active', lastActiveMinAgo: 25, since: 2025 },
  { id: 'u-igor', name: 'Игорь Белов', email: 'igor@stafftap.ru', roleId: 'support', status: 'active', lastActiveMinAgo: 90, since: 2026 },
];
