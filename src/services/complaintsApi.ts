import { apiFetch } from '@/lib/apiClient';

export type ComplaintTarget = 'worker' | 'company' | 'shift';

export type ComplaintReason = 'no_show' | 'rude' | 'misleading' | 'unsafe' | 'fake_profile' | 'payment' | 'other';

/** Жалоба уходит в очередь дашборда и сразу пингует дежурного (см.
 *  worker/src/routes/complaints.ts). Никакого автоматического действия за
 *  ней не следует: анкету скрывает или блокирует человек, посмотрев, —
 *  иначе жалобой можно было бы убирать конкурентов. */
export async function submitComplaint(input: {
  targetKind: ComplaintTarget;
  targetId: string;
  reason: ComplaintReason;
  comment?: string;
  /** Обе стороны могут жаловаться, а токен у них разный — вызывающий
   *  экран знает, чей он. */
  as?: 'worker' | 'company';
}): Promise<void> {
  await apiFetch('/complaints', {
    method: 'POST',
    as: input.as === 'company' ? 'company' : undefined,
    body: {
      targetKind: input.targetKind,
      targetId: Number(input.targetId),
      reason: input.reason,
      comment: input.comment ?? '',
    },
  });
}
