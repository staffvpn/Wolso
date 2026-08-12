import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Select } from '@/components/ui/Select';
import { Input, Label } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useUsersStore } from '@/store/useUsersStore';
import { useRolesStore } from '@/store/useRolesStore';
import { useCan } from '@/store/useSessionStore';
import { roleById } from '@/data/permissions';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/apiClient';
import type { PlatformUser, TeamMember } from '@/types';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

function SeekerDetail({ user }: { user: PlatformUser }) {
  const toggleBlock = useUsersStore((s) => s.toggleBlock);
  const switchRole = useUsersStore((s) => s.switchRole);
  const canBlock = useCan('blockUsers');
  const canSwitchRole = useCan('switchUserRole');
  const blocked = user.status === 'suspended';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={user.name} size={44} />
        <div>
          <p className="font-bold text-[17px] leading-tight">{user.name}</p>
          <p className="text-[13px] text-text-muted mt-0.5">{user.city} · {user.contact}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <Badge tone={blocked ? 'danger' : 'accent'}>{user.statusLabel}</Badge>
        {user.rating !== undefined && <Badge tone="neutral">★ {user.rating} · {user.shiftsCompleted} смен</Badge>}
      </div>
      <div className="rounded-xl bg-surface-2 p-4 text-[13px] text-text-muted leading-relaxed mb-6">
        Профиль соискателя: документы, история откликов и отзывы заведений доступны в карточке пользователя на платформе.
      </div>
      <div className="flex flex-col gap-2">
        <Button variant={blocked ? 'primary' : 'danger'} className="w-full" disabled={!canBlock} onClick={() => toggleBlock(user.id, 'seeker')}>
          {blocked ? 'Разблокировать' : 'Заблокировать'}
        </Button>
        <Button variant="outline" className="w-full" disabled={!canSwitchRole} onClick={() => switchRole(user.id, 'seeker')}>
          Переключить на работодателя
        </Button>
      </div>
    </div>
  );
}

function EmployerDetail({ user }: { user: PlatformUser }) {
  const toggleBlock = useUsersStore((s) => s.toggleBlock);
  const switchRole = useUsersStore((s) => s.switchRole);
  const canBlock = useCan('blockUsers');
  const canSwitchRole = useCan('switchUserRole');
  const blocked = user.status === 'suspended';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={user.name} size={44} square />
        <div>
          <p className="font-bold text-[17px] leading-tight">{user.name}</p>
          <p className="text-[13px] text-text-muted mt-0.5">{user.city} · {user.contact}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <Badge tone={blocked ? 'danger' : 'accent'}>{user.statusLabel}</Badge>
      </div>
      <div className="rounded-xl bg-surface-2 p-4 text-[13px] text-text-muted leading-relaxed mb-6">
        Профиль работодателя: опубликованные вакансии, история сотрудничества и отзывы соискателей доступны в карточке компании.
      </div>
      <div className="flex flex-col gap-2">
        <Button variant={blocked ? 'primary' : 'danger'} className="w-full" disabled={!canBlock} onClick={() => toggleBlock(user.id, 'employer')}>
          {blocked ? 'Разблокировать' : 'Заблокировать'}
        </Button>
        <Button variant="outline" className="w-full" disabled={!canSwitchRole} onClick={() => switchRole(user.id, 'employer')}>
          Переключить на соискателя
        </Button>
      </div>
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
