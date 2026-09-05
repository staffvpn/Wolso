import { create } from 'zustand';
import type { PlatformUser, TeamMember } from '@/types';
import { ApiError } from '@/lib/apiClient';
import {
  fetchTeam,
  fetchSeekers,
  fetchEmployers,
  toggleBlockSeeker,
  toggleBlockEmployer,
  toggleHideSeeker,
  inviteTeamMember,
  setTeamMemberRole,
  revokeTeamAccess,
  switchSeekerToEmployer,
  switchEmployerToSeeker,
  deleteSeeker,
  deleteEmployer,
  syncTelegramUsernames,
  checkBotStatus,
} from '@/services/usersApi';

interface UsersState {
  seekers: PlatformUser[];
  employers: PlatformUser[];
  team: TeamMember[];
  loading: boolean;
  loaded: boolean;
  syncingUsernames: boolean;
  checkingBot: boolean;
  /** Progress line while the bot check loops through the accounts. */
  botCheckResult: string | null;
  /** Whether that line is a failure, so the UI can colour it. */
  botCheckFailed: boolean;
  load: () => Promise<void>;
  toggleBlock: (id: string, kind: 'seeker' | 'employer', reason?: string) => Promise<void>;
  toggleHidden: (id: string, reason?: string) => Promise<void>;
  setTeamRole: (memberId: string, roleId: string) => Promise<void>;
  inviteMember: (name: string, telegramId: number, roleId: string) => Promise<void>;
  revokeAccess: (memberId: string) => Promise<void>;
  switchRole: (id: string, kind: 'seeker' | 'employer') => Promise<void>;
  deleteUser: (id: string, kind: 'seeker' | 'employer') => Promise<void>;
  syncUsernames: () => Promise<void>;
  checkBots: () => Promise<void>;
}

/** Почему не получилось проверить бота. Раньше на любую ошибку выводилось
 *  «проверьте, что воркер задеплоен» — совет, бесполезный ровно во всех
 *  случаях, кроме одного: сессия истекла, прав не хватает, не задан токен
 *  бота, воркер упёрся в лимит. Человек шёл перепроверять деплой, с
 *  которым всё было в порядке. */
function botCheckMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Не удалось связаться с сервером. Проверьте соединение и адрес API в настройках дашборда.';
  }
  switch (err.code) {
    case 'migration_required':
      return 'Не применена миграция 0025_bot_status. Откройте Настройки → Состояние базы данных → «Проверить миграции», там будет готовый SQL.';
    case 'no_bot_token':
      return 'У воркера не задан BOT_TOKEN — без него проверять нечего. Задайте секрет: Cloudflare → Workers → wolso-api → Settings → Variables and Secrets.';
    case 'internal_error':
      return 'Воркер ответил ошибкой. Откройте Cloudflare → Workers → wolso-api → Logs и посмотрите последнюю запись — там будет причина.';
  }
  if (err.status === 401) return 'Сессия истекла. Обновите страницу и войдите заново.';
  if (err.status === 403) return 'Недостаточно прав: проверка бота доступна ролям с правом на управление пользователями.';
  return `Не получилось проверить (ошибка ${err.status}${err.code ? `, ${err.code}` : ''}).`;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  seekers: [],
  employers: [],
  team: [],
  loading: false,
  loaded: false,
  syncingUsernames: false,
  checkingBot: false,
  botCheckResult: null,
  botCheckFailed: false,

  load: async () => {
    set({ loading: true });
    const [team, seekers, employers] = await Promise.all([fetchTeam(), fetchSeekers(), fetchEmployers()]);
    set({ team, seekers, employers, loading: false, loaded: true });
  },

  toggleBlock: async (id, kind, reason) => {
    const { status, reason: saved } =
      kind === 'seeker' ? await toggleBlockSeeker(id, reason) : await toggleBlockEmployer(id, reason);
    const statusLabel = status === 'suspended' ? 'Заблокирован' : 'Активен';
    const apply = (u: PlatformUser) =>
      u.id === id ? { ...u, status, statusLabel, suspendedReason: saved ?? undefined } : u;
    if (kind === 'seeker') set({ seekers: get().seekers.map(apply) });
    else set({ employers: get().employers.map(apply) });
  },

  /** Seekers only — an employer has no anketa to take out of the search. */
  toggleHidden: async (id, reason) => {
    const { hidden, reason: saved } = await toggleHideSeeker(id, reason);
    set({
      seekers: get().seekers.map((u) => (u.id === id ? { ...u, hidden, hiddenReason: saved ?? undefined } : u)),
    });
  },

  // These two used to update the store optimistically before the request
  // resolved — fine when the server never says no, but now that role
  // changes touching Owner can legitimately be rejected (403/400), an
  // optimistic update would show "success" in the UI for a call the
  // server actually refused. Await first, apply state only on success.
  setTeamRole: async (memberId, roleId) => {
    await setTeamMemberRole(memberId, roleId);
    set({ team: get().team.map((m) => (m.id === memberId ? { ...m, roleId } : m)) });
  },

  inviteMember: async (name, telegramId, roleId) => {
    await inviteTeamMember(name, telegramId, roleId);
    const team = await fetchTeam();
    set({ team });
  },

  revokeAccess: async (memberId) => {
    await revokeTeamAccess(memberId);
    set({ team: get().team.map((m) => (m.id === memberId ? { ...m, status: 'suspended' } : m)) });
  },

  switchRole: async (id, kind) => {
    if (kind === 'seeker') await switchSeekerToEmployer(id);
    else await switchEmployerToSeeker(id);
    const [seekers, employers] = await Promise.all([fetchSeekers(), fetchEmployers()]);
    set({ seekers, employers });
  },

  deleteUser: async (id, kind) => {
    if (kind === 'seeker') {
      await deleteSeeker(id);
      set({ seekers: get().seekers.filter((u) => u.id !== id) });
    } else {
      await deleteEmployer(id);
      set({ employers: get().employers.filter((u) => u.id !== id) });
    }
  },

  /** Walks every not-yet-established account in batches. Capped at 40
   *  rounds (1000 accounts) so a large base doesn't leave the button
   *  spinning indefinitely — press it again to continue where it left
   *  off, since checked rows are stamped and not re-picked. */
  checkBots: async () => {
    set({ checkingBot: true, botCheckResult: null, botCheckFailed: false });
    let active = 0;
    let unreachable = 0;
    let inconclusive = 0;
    try {
      for (let i = 0; i < 40; i++) {
        const res = await checkBotStatus();
        active += res.active;
        unreachable += res.unreachable;
        inconclusive += res.inconclusive;
        if (res.checked === 0 || res.remaining === 0) break;
      }
      const [seekers, employers] = await Promise.all([fetchSeekers(), fetchEmployers()]);
      set({
        seekers,
        employers,
        botCheckResult:
          active + unreachable + inconclusive === 0
            ? 'Все аккаунты уже проверены.'
            : `Проверено ${active + unreachable + inconclusive}: активны — ${active}, недоступны — ${unreachable}` +
              (inconclusive > 0 ? `, без ответа — ${inconclusive}` : '') +
              '.',
      });
    } catch (err) {
      // Сообщение должно называть причину, а не гадать. «Проверьте, что
      // воркер задеплоен» отправляло перепроверять деплой человека, у
      // которого на самом деле истекла сессия или не задан токен бота, —
      // и найти он там ничего не мог, потому что с деплоем всё было в
      // порядке.
      set({ botCheckResult: botCheckMessage(err), botCheckFailed: true });
    } finally {
      set({ checkingBot: false });
    }
  },

  syncUsernames: async () => {
    set({ syncingUsernames: true });
    try {
      for (let i = 0; i < 25; i++) {
        const { checked, updated } = await syncTelegramUsernames();
        if (checked === 0 || updated === 0) break;
      }
      const [seekers, employers] = await Promise.all([fetchSeekers(), fetchEmployers()]);
      set({ seekers, employers });
    } finally {
      set({ syncingUsernames: false });
    }
  },
}));
