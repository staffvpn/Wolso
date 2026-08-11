import { create } from 'zustand';
import type { AuditLogEntry } from '@/types';
import { AUDIT_LOG } from '@/data/auditLog';

interface AuditState {
  entries: AuditLogEntry[];
  log: (actorName: string, actorRoleLabel: string, action: string, tone?: AuditLogEntry['tone']) => void;
}

export const useAuditStore = create<AuditState>((set) => ({
  entries: AUDIT_LOG,
  log: (actorName, actorRoleLabel, action, tone = 'neutral') =>
    set((s) => ({
      entries: [{ id: `log-${Date.now()}`, actorName, actorRoleLabel, action, minutesAgo: 0, tone }, ...s.entries],
    })),
}));
