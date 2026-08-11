import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, History, Plus, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Input';
import { useRolesStore } from '@/store/useRolesStore';
import { useUsersStore } from '@/store/useUsersStore';
import { useCan } from '@/store/useSessionStore';
import { PERMISSIONS } from '@/data/permissions';
import { cn } from '@/lib/cn';
import type { PermissionKey, PermissionValue, RoleDef } from '@/types';

export function Roles() {
  const navigate = useNavigate();
  const { roles, memberCountFor, updatePermission, twoFactorRequired, setTwoFactorRequired } = useRolesStore();
  const team = useUsersStore((s) => s.team);
  const loadUsers = useUsersStore((s) => s.load);
  const canManageTeam = useCan('manageTeam');
  const [selectedRoleId, setSelectedRoleId] = useState('owner');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cyclePermission(role: RoleDef, key: PermissionKey) {
    if (!canManageTeam || role.id === 'owner') return;
    const order: PermissionValue[] = key === 'blockUsers' ? ['no', 'confirm', 'yes'] : ['no', 'yes'];
    const idx = order.indexOf(role.permissions[key]);
    updatePermission(role.id, key, order[(idx + 1) % order.length]);
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Роли и права"
        subtitle={`${roles.length} роли · ${team.length} человек в команде`}
        right={
          <>
            <Button variant="outline" onClick={() => navigate('/audit-log')}>
              <History size={15} /> История изменений
            </Button>
            <Button variant="primary" disabled={!canManageTeam} onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> Своя роль
            </Button>
          </>
        }
      />

      <div className="px-4 sm:px-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <button key={role.id} onClick={() => setSelectedRoleId(role.id)} className="text-left">
            <Card
              className={cn(
                'p-5 h-full transition-colors',
                selectedRoleId === role.id ? 'border-accent bg-accent-soft/40 ring-1 ring-accent' : 'hover:border-border',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[15px]" style={{ color: selectedRoleId === role.id ? 'var(--color-accent)' : undefined }}>
                  {role.name}
                </span>
                {!role.isSystem && <Badge tone="neutral">своя</Badge>}
              </div>
              <p className="text-[13px] text-text-muted leading-relaxed mb-3">{role.description}</p>
              <p className="text-[13px] font-semibold text-text-faint">{memberCountFor(role.id)} человек</p>
            </Card>
          </button>
        ))}
      </div>

      <div className="px-4 sm:px-8 mt-4">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-soft">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-faint">Право</th>
                  {roles.map((role) => (
                    <th key={role.id} className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-faint whitespace-nowrap">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {PERMISSIONS.map((p) => (
                  <tr key={p.key}>
                    <td className="px-5 py-3.5 text-[14px] font-medium text-text">{p.label}</td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => cyclePermission(role, p.key)}
                          disabled={!canManageTeam || role.id === 'owner'}
                          className={cn('inline-flex', role.id !== 'owner' && canManageTeam && 'cursor-pointer')}
                        >
                          <PermissionCell value={role.permissions[p.key]} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="px-4 sm:px-8 mt-4">
        <Card className="p-5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-warning-soft text-warning flex items-center justify-center shrink-0">
            <ShieldAlert size={17} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[14px]">Двухфакторная аутентификация обязательна для Owner и Админов</p>
            <p className="text-[13px] text-text-muted mt-0.5">Действия с деньгами дополнительно подтверждаются кодом</p>
          </div>
          <Toggle checked={twoFactorRequired} onChange={setTwoFactorRequired} disabled={!canManageTeam} />
        </Card>
      </div>

      <CreateRoleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id) => setSelectedRoleId(id)} />
    </div>
  );
}

function PermissionCell({ value }: { value: PermissionValue }) {
  if (value === 'yes') return <Check size={17} className="text-accent mx-auto" strokeWidth={3} />;
  if (value === 'confirm') return <Badge tone="warning">с подтверждением</Badge>;
  return <span className="text-text-faint">–</span>;
}

function CreateRoleModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const createRole = useRolesStore((s) => s.createRole);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState<Record<PermissionKey, PermissionValue>>(() =>
    Object.fromEntries(PERMISSIONS.map((p) => [p.key, 'no'])) as Record<PermissionKey, PermissionValue>,
  );

  function toggle(key: PermissionKey) {
    setPerms((prev) => ({ ...prev, [key]: prev[key] === 'yes' ? 'no' : 'yes' }));
  }

  async function submit() {
    if (!name.trim()) return;
    const role = await createRole(name.trim(), description.trim() || 'Своя роль', { ...perms, transferOwnership: 'no' });
    onCreated(role.id);
    setName('');
    setDescription('');
    setPerms(Object.fromEntries(PERMISSIONS.map((p) => [p.key, 'no'])) as Record<PermissionKey, PermissionValue>);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Своя роль" description="Настройте права под конкретную задачу в команде" width={520}>
      <div className="space-y-4">
        <div>
          <Label>Название роли</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Финансист" />
        </div>
        <div>
          <Label>Описание</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко — для чего эта роль" />
        </div>
        <div>
          <Label>Права</Label>
          <div className="divide-y divide-border-soft border border-border-soft rounded-xl overflow-hidden">
            {PERMISSIONS.filter((p) => p.key !== 'transferOwnership').map((p) => (
              <label key={p.key} className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[13px] text-text">{p.label}</span>
                <Toggle checked={perms[p.key] === 'yes'} onChange={() => toggle(p.key)} />
              </label>
            ))}
          </div>
        </div>
        <Button variant="primary" className="w-full mt-1" onClick={submit}>
          Создать роль
        </Button>
      </div>
    </Modal>
  );
}
