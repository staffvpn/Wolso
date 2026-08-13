import type { Env, PermissionKey, PermissionValue } from '../types';

/** Row shapes as they come back from D1 (snake_case, SQLite types). */

export interface ShiftRow {
  id: number;
  company_id: number;
  position: string;
  position_label: string;
  date: string;
  start_hour: number;
  start_min: number;
  end_hour: number;
  end_min: number;
  hourly_rate: number;
  total_pay: number;
  description: string;
  meal: number;
  urgency: string;
  employment_type: string;
  time_of_day: string;
  requirements: string;
  status: string;
  created_at: string;
  // joined
  company_name?: string;
  company_address?: string;
  company_city?: string;
  company_logo_initial?: string;
  company_logo_color?: string;
  company_rating?: number;
  company_reviews_count?: number;
  company_has_avatar?: number;
  company_description?: string;
  company_photo_ids?: string | null;
}

function companyPhotosFrom(r: ShiftRow) {
  const ids = r.company_photo_ids ? (JSON.parse(r.company_photo_ids) as number[]) : [];
  return ids.map((id) => ({ id, url: `/media/companies/${r.company_id}/photos/${id}` }));
}

export function shiftToJson(r: ShiftRow) {
  return {
    id: r.id,
    companyId: r.company_id,
    position: r.position,
    positionLabel: r.position_label,
    date: r.date,
    startHour: r.start_hour,
    startMin: r.start_min,
    endHour: r.end_hour,
    endMin: r.end_min,
    hourlyRate: r.hourly_rate,
    totalPay: r.total_pay,
    description: r.description,
    meal: !!r.meal,
    urgency: r.urgency,
    employmentType: r.employment_type,
    timeOfDay: r.time_of_day,
    requirements: JSON.parse(r.requirements || '[]'),
    status: r.status,
    createdAt: r.created_at,
    company: r.company_name
      ? {
          id: r.company_id,
          name: r.company_name,
          address: r.company_address,
          city: r.company_city,
          logoInitial: r.company_logo_initial,
          logoColor: r.company_logo_color,
          rating: r.company_rating,
          reviewsCount: r.company_reviews_count,
          avatarUrl: r.company_has_avatar ? `/media/companies/${r.company_id}/avatar` : null,
          description: r.company_description || undefined,
          photos: companyPhotosFrom(r),
        }
      : undefined,
  };
}

export const SHIFT_SELECT = `
  SELECT s.*, c.name as company_name, c.address as company_address, c.city as company_city,
         c.logo_initial as company_logo_initial, c.logo_color as company_logo_color,
         c.rating as company_rating, c.reviews_count as company_reviews_count,
         (c.avatar_data IS NOT NULL) as company_has_avatar, c.description as company_description,
         (SELECT json_group_array(id) FROM company_photos cp WHERE cp.company_id = c.id) as company_photo_ids
  FROM shifts s JOIN companies c ON c.id = s.company_id
`;

export async function getRolePermissions(env: Env, roleId: string): Promise<Record<PermissionKey, PermissionValue> | null> {
  const row = await env.DB.prepare('SELECT permissions FROM roles WHERE id = ?').bind(roleId).first<{ permissions: string }>();
  return row ? JSON.parse(row.permissions) : null;
}

/** The chat tied to a shift only ever makes sense while there's an active
 *  engagement over it — invited, confirmed, or actually being worked.
 *  Every way that engagement can end (declined, cancelled by either side,
 *  or the shift being closed once it's happened) shares this same
 *  cleanup; messages cascade-delete with the chat row. */
export async function deleteShiftChat(env: Env, companyId: number, workerId: number, shiftId: number | string): Promise<void> {
  await env.DB.prepare('DELETE FROM chats WHERE company_id = ? AND worker_id = ? AND shift_id = ?')
    .bind(companyId, workerId, shiftId)
    .run();
}
