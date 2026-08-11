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
  moderation_flag_label: string | null;
  moderation_flag_tone: string | null;
  created_at: string;
  // joined
  company_name?: string;
  company_address?: string;
  company_city?: string;
  company_logo_initial?: string;
  company_logo_color?: string;
  company_rating?: number;
  company_reviews_count?: number;
  company_verified?: number;
  company_inn?: string;
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
    moderationFlag: r.moderation_flag_label ? { label: r.moderation_flag_label, tone: r.moderation_flag_tone } : null,
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
          verified: !!r.company_verified,
          inn: r.company_inn,
        }
      : undefined,
  };
}

export const SHIFT_SELECT = `
  SELECT s.*, c.name as company_name, c.address as company_address, c.city as company_city,
         c.logo_initial as company_logo_initial, c.logo_color as company_logo_color,
         c.rating as company_rating, c.reviews_count as company_reviews_count,
         c.verified as company_verified, c.inn as company_inn
  FROM shifts s JOIN companies c ON c.id = s.company_id
`;

export async function getRolePermissions(env: Env, roleId: string): Promise<Record<PermissionKey, PermissionValue> | null> {
  const row = await env.DB.prepare('SELECT permissions FROM roles WHERE id = ?').bind(roleId).first<{ permissions: string }>();
  return row ? JSON.parse(row.permissions) : null;
}
