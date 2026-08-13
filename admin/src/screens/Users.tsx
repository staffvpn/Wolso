import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, UserPlus, Send, ImageOff } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Select } from '@/components/ui/Select';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useUsersStore } from '@/store/useUsersStore';
import { useUserDetailStore } from '@/store/useUserDetailStore';
import { useRolesStore } from '@/store/useRolesStore';
import { useCan } from '@/store/useSessionStore';
import { roleById } from '@/data/permissions';
import { timeAgo, telegramLink, telegramLabel, formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/apiClient';
import type { PlatformUser, TeamMember, UserPhoto } from '@/types';

const ERROR_MESSAGES: Record<string, string> = {
  owner_transfer_requires_permission: 'Передать или снять роль владельца может только сам владелец.',
  must_keep_one_owner: 'Нельзя оставить платформу без единственного владельца.',
  already_invited: 'Этот Telegram ID уже приглашён.',
  unknown_role: 'Такой роли не существует.',
};

function friendlyError(err: unknown): string {
  if (err instanceof ApiError && err.code && ERROR_MESSAGES[err.code]) return ERROR_MESSAGES[err.code];
  return 'Не получилось выполнить действие — попробуйте ещё раз.';
}

type Tab = 'all' | 'seekers' | 'employers' | 'team';
type Row = { kind: 'team'; member: TeamMember } | { kind: 'seeker' | 'employer'; user: PlatformUser };

const STATUS_COLOR: Record<string, string> = {
  active: 'text-accent',
  invited: 'text-info',
  suspended: 'text-danger',
};

const APPLICATION_STATUS_LABEL: Record<string, string> = {
  pending: 'Ждёт ответа',
  invited: 'Приглашён',
  accepted: 'Подтверждено',
  declined: 'Отклонено',
  cancelled: 'Отменено',
};

const VACANCY_STATUS: Record<string, { label: string; tone: 'accent' | 'warning' | 'neutral' | 'danger' }> = {
  active: { label: 'Активна', tone: 'accent' },
  pending_review: { label: 'На модерации', tone: 'warning' },
  closed: { label: 'Закрыта', tone: 'neutral' },
  rejected: { label: 'Отклонена', tone: 'danger' },
};

function ageFromBirthdate(birthdate?: string): number | null {
  if (!birthdate) return null;
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** Opens the person's real Telegram account — a username gives a
 *  universal https://t.me link, a bare id falls back to a tg:// deep
 *  link (best-effort, works from clients with Telegram registered as a
 *  protocol handler). */
function TelegramLinkRow({ telegramId, telegramUsername }: { telegramId: number; telegramUsername?: string }) {
  return (
    <a
      href={telegramLink(telegramId, telegramUsername)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent mb-4 hover:underline"
    >
      <Send size={13} /> {telegramLabel(telegramId, telegramUsername)}
    </a>
  );
}

export function Users() {
  const { seekers, employers, team, load } = useUsersStore();
  const roles = useRolesStore((s) => s.roles);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const canManageTeam = useCan('manageTeam');
  const totalUsers = team.length + seekers.length + employers.length;

  useEffect(() => {
    load();
    // People edit their own name/photo from the mobile app, in their own
    // session — nothing here tells this screen that happened, so poll
    // instead of only ever refreshing on navigation.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the open detail panel pointed at the live object after a poll (or
  // a block/role-switch/revoke) refreshes the list — otherwise it'd keep
  // showing whatever was selected at the moment you opened it. If the row
  // is gone from its own list (e.g. it just got switched to the other
  // role), close the panel rather than guess — a seeker id and an employer
  // id can coincidentally collide since they're separate tables.
  useEffect(() => {
    setSelected((prev) => {
      if (!prev) return prev;
      if (prev.kind === 'team') {
        const fresh = team.find((m) => m.id === prev.member.id);
        return fresh ? (fresh !== prev.member ? { kind: 'team', member: fresh } : prev) : null;
      }
      const list = prev.kind === 'seeker' ? seekers : employers;
      const fresh = list.find((u) => u.id === prev.user.id);
      return fresh ? (fresh !== prev.user ? ({ kind: prev.kind, user: fresh } as Row) : prev) : null;
    });
  }, [seekers, employers, team]);

  const rows: Row[] = useMemo(() => {
    const teamRows: Row[] = team.map((member) => ({ kind: 'team', member }));
    const seekerRows: Row[] = seekers.map((user) => ({ kind: 'seeker', user }));
    const employerRows: Row[] = employers.map((user) => ({ kind: 'employer', user }));
    if (tab === 'team') return teamRows;
    if (tab === 'seekers') return seekerRows;
    if (tab === 'employers') return employerRows;
    return [...teamRows, ...seekerRows, ...employerRows];
  }, [tab, team, seekers, employers]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const name = r.kind === 'team' ? r.member.name : r.user.name;
      const contact = r.kind === 'team' ? r.member.contact : r.user.contact;
      return name.toLowerCase().includes(q) || contact.toLowerCase().includes(q);
    });
  }, [rows, query]);

  const rowKey = (r: Row) => (r.kind === 'team' ? r.member.id : r.user.id);
  const selectedKey = selected ? rowKey(selected) : null;

  return (
    <div className="pb-10 flex flex-col lg:h-full lg:min-h-0">
      <PageHeader title="Пользователи" />

      <div className="px-4 sm:px-8 pb-5 flex items-center gap-3 flex-wrap shrink-0">
        <div className="relative w-full sm:w-[260px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <Input placeholder="Имя, телефон" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { id: 'all', label: 'Все', count: totalUsers },
            { id: 'seekers', label: 'Соискатели' },
            { id: 'employers', label: 'Работодатели' },
            { id: 'team', label: 'Команда', count: team.length },
          ]}
        />
        <Button variant="primary" className="ml-auto" disabled={!canManageTeam} onClick={() => setInviteOpen(true)}>
          <UserPlus size={15} /> Пригласить в команду
        </Button>
      </div>

      <div className="lg:flex-1 lg:min-h-0 px-4 sm:px-8 pb-6 lg:pb-0 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        <Card className="lg:overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1.6fr_1fr] sm:grid-cols-[1.6fr_1fr_1fr_1fr] px-5 py-3 border-b border-border-soft text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            <span>Пользователь</span>
            <span className="hidden sm:block">Роль</span>
            <span>Статус</span>
            <span className="hidden sm:block">Активность</span>
          </div>
          <div className="lg:overflow-y-auto divide-y divide-border-soft">
            {filtered.map((r) => {
              const name = r.kind === 'team' ? r.member.name : r.user.name;
              const contact = r.kind === 'team' ? r.member.contact : r.user.contact;
              const lastActive = r.kind === 'team' ? r.member.createdMinAgo : r.user.createdMinAgo;
              const roleLabel = r.kind === 'team' ? roleById(r.member.roleId, roles).name : r.kind === 'seeker' ? 'Соискатель' : 'Работодатель';
              const statusLabel = r.kind === 'team' ? (r.member.status === 'invited' ? 'Приглашён' : r.member.status === 'suspended' ? 'Доступ отозван' : 'Активен') : r.user.statusLabel;
              const statusKey = r.kind === 'team' ? r.member.status : r.user.status;

              return (
                <button
                  key={rowKey(r)}
                  onClick={() => setSelected(r)}
                  className={cn('w-full grid grid-cols-[1.6fr_1fr] sm:grid-cols-[1.6fr_1fr_1fr_1fr] items-center px-5 py-3 text-left hover:bg-surface-2 transition-colors', selectedKey === rowKey(r) && 'bg-surface-2')}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={name} size={32} square={r.kind === 'employer'} />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-text truncate">{name}</span>
                      <span className="block text-[12px] text-text-faint truncate">{contact}</span>
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <Badge tone={r.kind === 'team' ? 'dark' : 'neutral'}>{roleLabel}</Badge>
                  </span>
                  <span className={cn('text-[13px] font-medium', STATUS_COLOR[statusKey])}>{statusLabel}</span>
                  <span className="hidden sm:block text-[13px] text-text-faint">{timeAgo(lastActive)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-text-faint">Никого не нашли</p>}
          </div>
        </Card>

        <Card className="p-6 h-fit lg:sticky lg:top-0">
          {!selected && <EmptyPanel title="Выберите пользователя" description="Нажмите на строку слева, чтобы увидеть подробности." />}
          {selected?.kind === 'team' && <TeamDetail member={selected.member} />}
          {selected?.kind === 'seeker' && <SeekerDetail user={selected.user} />}
          {selected?.kind === 'employer' && <EmployerDetail user={selected.user} />}
        </Card>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function TeamDetail({ member }: { member: TeamMember }) {
  const roles = useRolesStore((s) => s.roles);
  const setTeamRole = useUsersStore((s) => s.setTeamRole);
  const revokeAccess = useUsersStore((s) => s.revokeAccess);
  const canManageTeam = useCan('manageTeam');
  const canTransferOwnership = useCan('transferOwnership');
  const role = roleById(member.roleId, roles);

  // Installing or removing an Owner needs transferOwnership, not just
  // manageTeam — the server enforces this too, this just keeps the UI
  // from offering an action that would fail. Only owner is ever excluded;
  // the built-in vs custom-role distinction isn't relevant here.
  const isOwnerRow = member.roleId === 'owner';
  const canEditThisMember = canManageTeam && (!isOwnerRow || canTransferOwnership);
  const selectableRoles = canTransferOwnership ? roles : roles.filter((r) => r.id !== 'owner');

  const [roleId, setRoleId] = useState(member.roleId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveRole() {
    setError(null);
    setBusy(true);
    try {
      await setTeamRole(member.id, roleId);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setError(null);
    setBusy(true);
    try {
      await revokeAccess(member.id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Avatar name={member.name} size={44} />
        <div>
          <p className="font-bold text-[17px] leading-tight">{member.name}</p>
          <p className="text-[13px] text-text-muted mt-0.5">{role.name} · с {member.since} года</p>
        </div>
      </div>

      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mt-6 mb-2">Роль</p>
      <Select value={roleId} disabled={!canEditThisMember} onChange={(e) => setRoleId(e.target.value)}>
        {selectableRoles.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </Select>
      <p className="text-[13px] text-text-muted mt-2 leading-relaxed">{roleById(roleId, roles).description}</p>
      {isOwnerRow && !canTransferOwnership && (
        <p className="text-[12px] text-warning mt-2 leading-relaxed">
          Передать или снять роль владельца может только сам владелец.
        </p>
      )}
      {error && <p className="text-[12px] text-danger mt-2 leading-relaxed">{error}</p>}

      <div className="flex flex-col gap-2 mt-7">
        <Button variant="dark" disabled={!canEditThisMember || busy} onClick={saveRole}>
          Сохранить
        </Button>
        <Button variant="outline" className="text-danger border-danger/30" disabled={!canEditThisMember || busy} onClick={revoke}>
          Отозвать доступ
        </Button>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return <p className="text-[13px] text-text-faint py-8 text-center">Загружаем анкету…</p>;
}

function PhotoStrip({ photos }: { photos: UserPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-[13px] text-text-faint">
        <ImageOff size={15} /> Фото не загружены
      </div>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((p) => (
        <img key={p.id} src={p.url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
      ))}
    </div>
  );
}

function formatShiftWhen(date: string, startHour: number, startMin: number) {
  const d = new Date(date);
  const day = Number.isNaN(d.getTime()) ? date : formatDayMonth(d);
  return `${day}, ${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-1.5">{children}</p>;
}

function SeekerDetail({ user }: { user: PlatformUser }) {
  const toggleBlock = useUsersStore((s) => s.toggleBlock);
  const switchRole = useUsersStore((s) => s.switchRole);
  const deleteUser = useUsersStore((s) => s.deleteUser);
  const detail = useUserDetailStore((s) => s.seeker);
  const loadSeeker = useUserDetailStore((s) => s.loadSeeker);
  const updateSeeker = useUserDetailStore((s) => s.updateSeeker);
  const canBlock = useCan('blockUsers');
  const canSwitchRole = useCan('switchUserRole');
  const canManageData = useCan('manageData');
  const blocked = user.status === 'suspended';
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: '', bio: '', skills: '', birthdate: '' });

  useEffect(() => {
    setEditing(false);
    loadSeeker(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (detail && detail.id === user.id) {
      setForm({ name: detail.name, city: detail.city, bio: detail.bio, skills: detail.skills, birthdate: detail.birthdate ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const ready = detail && detail.id === user.id ? detail : null;
  const age = ageFromBirthdate(ready?.birthdate);
  const activeApplications = ready?.applications.filter(
    (a) => a.workStage !== 'employer_closed' && a.workStage !== 'reviewed' && a.status !== 'cancelled' && a.status !== 'declined',
  ) ?? [];
  const completedApplications = ready?.applications.filter((a) => a.workStage === 'employer_closed' || a.workStage === 'reviewed') ?? [];

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await updateSeeker(user.id, {
        name: form.name.trim(),
        city: form.city.trim(),
        bio: form.bio.trim(),
        skills: form.skills.trim(),
        birthdate: form.birthdate || undefined,
      });
      setEditing(false);
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={user.name} size={44} src={ready?.avatarUrl} />
        <div className="min-w-0">
          <p className="font-bold text-[17px] leading-tight truncate">{user.name}</p>
          <p className="text-[13px] text-text-muted mt-0.5">{user.city}{age !== null ? ` · ${age} лет` : ''}</p>
        </div>
      </div>

      <TelegramLinkRow telegramId={user.telegramId} telegramUsername={user.telegramUsername} />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Badge tone={blocked ? 'danger' : 'accent'}>{user.statusLabel}</Badge>
        {user.rating !== undefined && <Badge tone="neutral">★ {user.rating} · {user.shiftsCompleted} смен</Badge>}
      </div>

      {!ready && <DetailSkeleton />}

      {ready && !editing && (
        <div className="space-y-5 mb-6">
          <div>
            <SectionLabel>О себе</SectionLabel>
            <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{ready.bio || '—'}</p>
          </div>
          <div>
            <SectionLabel>Навыки</SectionLabel>
            <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{ready.skills || '—'}</p>
          </div>
          <div>
            <SectionLabel>Опыт работы</SectionLabel>
            {ready.positions.length === 0 && <p className="text-[13px] text-text-faint">Не указан</p>}
            <div className="flex flex-col gap-1.5">
              {ready.positions.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-text">{p.positionLabel}</span>
                  <span className="text-text-faint">{p.months} мес.</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Фото</SectionLabel>
            <PhotoStrip photos={ready.photos} />
          </div>
          <div>
            <SectionLabel>Активные смены{activeApplications.length > 0 ? ` (${activeApplications.length})` : ''}</SectionLabel>
            {activeApplications.length === 0 && <p className="text-[13px] text-text-faint">Нет активных откликов</p>}
            <div className="flex flex-col gap-2">
              {activeApplications.map((a) => (
                <div key={a.id} className="rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text">{a.positionLabel}</span>
                    <Badge tone="info">{APPLICATION_STATUS_LABEL[a.status] ?? a.status}</Badge>
                  </div>
                  <p className="text-text-faint mt-0.5">{a.companyName} · {formatShiftWhen(a.date, a.startHour, a.startMin)}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Завершённые смены{completedApplications.length > 0 ? ` (${completedApplications.length})` : ''}</SectionLabel>
            {completedApplications.length === 0 && <p className="text-[13px] text-text-faint">Пока нет</p>}
            <div className="flex flex-col gap-2">
              {completedApplications.map((a) => (
                <div key={a.id} className="rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text">{a.positionLabel}</span>
                    {a.rating !== null && <Badge tone="neutral">★ {a.rating}</Badge>}
                  </div>
                  <p className="text-text-faint mt-0.5">{a.companyName} · {formatShiftWhen(a.date, a.startHour, a.startMin)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {ready && editing && (
        <div className="space-y-3 mb-6">
          <div>
            <Label>Имя и фамилия</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Город</Label>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <Label>Дата рождения</Label>
            <Input type="date" value={form.birthdate} onChange={(e) => setForm((f) => ({ ...f, birthdate: e.target.value }))} />
          </div>
          <div>
            <Label>О себе</Label>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          </div>
          <div>
            <Label>Навыки</Label>
            <Textarea rows={2} value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))} />
          </div>
          {formError && <p className="text-[12px] text-danger leading-relaxed">{formError}</p>}
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" disabled={saving} onClick={save}>Сохранить</Button>
            <Button variant="outline" className="flex-1" disabled={saving} onClick={() => setEditing(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {ready && !editing && (
        <Button variant="outline" className="w-full mb-2" disabled={!canBlock} onClick={() => setEditing(true)}>
          Редактировать анкету
        </Button>
      )}

      <div className="flex flex-col gap-2">
        <Button variant={blocked ? 'primary' : 'danger'} className="w-full" disabled={!canBlock} onClick={() => toggleBlock(user.id, 'seeker')}>
          {blocked ? 'Разблокировать' : 'Заблокировать'}
        </Button>
        <Button variant="outline" className="w-full" disabled={!canSwitchRole} onClick={() => switchRole(user.id, 'seeker')}>
          Переключить на работодателя
        </Button>
        <Button variant="outline" className="w-full text-danger border-danger/30" disabled={!canManageData} onClick={() => setDeleting(true)}>
          Удалить навсегда
        </Button>
      </div>
      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить соискателя?"
        description={`${user.name} и вся его история (отклики, чаты, уведомления, избранное) удаляются без возможности восстановить.`}
        confirmLabel="Удалить"
        onConfirm={() => deleteUser(user.id, 'seeker')}
      />
    </div>
  );
}

function EmployerDetail({ user }: { user: PlatformUser }) {
  const toggleBlock = useUsersStore((s) => s.toggleBlock);
  const switchRole = useUsersStore((s) => s.switchRole);
  const deleteUser = useUsersStore((s) => s.deleteUser);
  const detail = useUserDetailStore((s) => s.employer);
  const loadEmployer = useUserDetailStore((s) => s.loadEmployer);
  const updateEmployer = useUserDetailStore((s) => s.updateEmployer);
  const canBlock = useCan('blockUsers');
  const canSwitchRole = useCan('switchUserRole');
  const canManageData = useCan('manageData');
  const blocked = user.status === 'suspended';
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', description: '', foundedYear: '' });

  useEffect(() => {
    setEditing(false);
    loadEmployer(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (detail && detail.id === user.id) {
      setForm({
        name: detail.name,
        address: detail.address ?? '',
        city: detail.city,
        description: detail.description,
        foundedYear: detail.foundedYear ? String(detail.foundedYear) : '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const ready = detail && detail.id === user.id ? detail : null;
  const activeVacancies = ready?.vacancies.filter((v) => v.status === 'active' || v.status === 'pending_review') ?? [];
  const closedVacancies = ready?.vacancies.filter((v) => v.status === 'closed' || v.status === 'rejected') ?? [];

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await updateEmployer(user.id, {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        description: form.description.trim(),
        foundedYear: form.foundedYear ? Number(form.foundedYear) : undefined,
      });
      setEditing(false);
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={user.name} size={44} square src={ready?.avatarUrl} />
        <div className="min-w-0">
          <p className="font-bold text-[17px] leading-tight truncate">{user.name}</p>
          <p className="text-[13px] text-text-muted mt-0.5">{user.city}{ready?.foundedYear ? ` · с ${ready.foundedYear}` : ''}</p>
        </div>
      </div>

      <TelegramLinkRow telegramId={user.telegramId} telegramUsername={user.telegramUsername} />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Badge tone={blocked ? 'danger' : 'accent'}>{user.statusLabel}</Badge>
        {ready && ready.rating > 0 && <Badge tone="neutral">★ {ready.rating} · {ready.reviewsCount} отзывов</Badge>}
      </div>

      {!ready && <DetailSkeleton />}

      {ready && !editing && (
        <div className="space-y-5 mb-6">
          <div>
            <SectionLabel>Описание</SectionLabel>
            <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{ready.description || '—'}</p>
          </div>
          <div>
            <SectionLabel>Адрес</SectionLabel>
            <p className="text-[13px] text-text leading-relaxed">{ready.address || '—'}</p>
          </div>
          <div>
            <SectionLabel>Фото</SectionLabel>
            <PhotoStrip photos={ready.photos} />
          </div>
          <div>
            <SectionLabel>Активные вакансии{activeVacancies.length > 0 ? ` (${activeVacancies.length})` : ''}</SectionLabel>
            {activeVacancies.length === 0 && <p className="text-[13px] text-text-faint">Нет активных вакансий</p>}
            <div className="flex flex-col gap-2">
              {activeVacancies.map((v) => {
                const meta = VACANCY_STATUS[v.status] ?? { label: v.status, tone: 'neutral' as const };
                return (
                  <div key={v.id} className="rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text">{v.positionLabel}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="text-text-faint mt-0.5">{formatDayMonth(new Date(v.date))} · откликов: {v.responseCount}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <SectionLabel>Завершённые вакансии{closedVacancies.length > 0 ? ` (${closedVacancies.length})` : ''}</SectionLabel>
            {closedVacancies.length === 0 && <p className="text-[13px] text-text-faint">Пока нет</p>}
            <div className="flex flex-col gap-2">
              {closedVacancies.map((v) => {
                const meta = VACANCY_STATUS[v.status] ?? { label: v.status, tone: 'neutral' as const };
                return (
                  <div key={v.id} className="rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text">{v.positionLabel}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="text-text-faint mt-0.5">{formatDayMonth(new Date(v.date))} · откликов: {v.responseCount}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {ready && editing && (
        <div className="space-y-3 mb-6">
          <div>
            <Label>Название заведения</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Город</Label>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <Label>Адрес</Label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <Label>Год основания</Label>
            <Input
              value={form.foundedYear}
              onChange={(e) => setForm((f) => ({ ...f, foundedYear: e.target.value.replace(/[^0-9]/g, '') }))}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          {formError && <p className="text-[12px] text-danger leading-relaxed">{formError}</p>}
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" disabled={saving} onClick={save}>Сохранить</Button>
            <Button variant="outline" className="flex-1" disabled={saving} onClick={() => setEditing(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {ready && !editing && (
        <Button variant="outline" className="w-full mb-2" disabled={!canBlock} onClick={() => setEditing(true)}>
          Редактировать профиль
        </Button>
      )}

      <div className="flex flex-col gap-2">
        <Button variant={blocked ? 'primary' : 'danger'} className="w-full" disabled={!canBlock} onClick={() => toggleBlock(user.id, 'employer')}>
          {blocked ? 'Разблокировать' : 'Заблокировать'}
        </Button>
        <Button variant="outline" className="w-full" disabled={!canSwitchRole} onClick={() => switchRole(user.id, 'employer')}>
          Переключить на соискателя
        </Button>
        <Button variant="outline" className="w-full text-danger border-danger/30" disabled={!canManageData} onClick={() => setDeleting(true)}>
          Удалить навсегда
        </Button>
      </div>
      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить работодателя?"
        description={`${user.name} и вся его история (вакансии, отклики, чаты, уведомления) удаляются без возможности восстановить.`}
        confirmLabel="Удалить"
        onConfirm={() => deleteUser(user.id, 'employer')}
      />
    </div>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const roles = useRolesStore((s) => s.roles);
  const inviteMember = useUsersStore((s) => s.inviteMember);
  const canTransferOwnership = useCan('transferOwnership');
  // There's already exactly one Owner (bootstrapped from OWNER_TELEGRAM_ID)
  // — inviting a second one needs transferOwnership, so it's not offered
  // here at all for anyone else.
  const selectableRoles = canTransferOwnership ? roles : roles.filter((r) => r.id !== 'owner');
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [roleId, setRoleId] = useState('moderator');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const id = Number(telegramId);
    if (!name.trim() || !id) return;
    setSubmitting(true);
    setError(null);
    try {
      await inviteMember(name.trim(), id, roleId);
      setName('');
      setTelegramId('');
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Пригласить в команду" description="Доступ открывается по входу через Telegram">
      <div className="space-y-4">
        <div>
          <Label>Имя</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Петров" />
        </div>
        <div>
          <Label>Telegram ID</Label>
          <Input
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Например, 123456789"
            inputMode="numeric"
          />
          <p className="text-[12px] text-text-faint mt-1.5">Числовой ID из Telegram — его можно узнать у @userinfobot.</p>
        </div>
        <div>
          <Label>Роль</Label>
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {selectableRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>
        {error && <p className="text-[12px] text-danger leading-relaxed">{error}</p>}
        <Button variant="primary" className="w-full mt-2" disabled={submitting} onClick={submit}>
          {submitting ? 'Приглашаем…' : 'Пригласить'}
        </Button>
      </div>
    </Modal>
  );
}
