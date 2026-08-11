import { apiFetch } from '@/lib/apiClient';

export interface TelegramLoginPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface StaffSession {
  token: string;
  staffId: string;
  name: string;
  roleId: string;
}

export async function loginWithTelegram(payload: TelegramLoginPayload): Promise<StaffSession> {
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) body[key] = String(value);

  const { token, staff } = await apiFetch<{ token: string; staff: { id: number; name: string; roleId: string } }>('/auth/telegram-login', {
    method: 'POST',
    body,
  });
  return { token, staffId: String(staff.id), name: staff.name, roleId: staff.roleId };
}
