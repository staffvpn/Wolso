import { apiFetch } from '@/lib/apiClient';
import type { Position, WorkerDocument, WorkerExperience } from '@/types';

interface MeResponse {
  worker: {
    id: number;
    name: string;
    city: string;
    rating: number;
    shifts_completed: number;
    referral_code: string | null;
    profileCompletion: number;
  };
  positions: { position: string; position_label: string; years: number }[];
  documents: { doc_type: string; label: string; status: string; note: string | null }[];
}

export interface WorkerProfileSummary {
  name: string;
  city: string;
  rating: number;
  shiftsCompleted: number;
  profileCompletion: number;
  referralCode: string;
  positions: WorkerExperience[];
  documents: WorkerDocument[];
}

function fromApi(r: MeResponse): WorkerProfileSummary {
  return {
    name: r.worker.name,
    city: r.worker.city,
    rating: r.worker.rating,
    shiftsCompleted: r.worker.shifts_completed,
    profileCompletion: r.worker.profileCompletion,
    referralCode: r.worker.referral_code ?? '',
    positions: r.positions.map((p) => ({ position: p.position as Position, positionLabel: p.position_label, years: p.years })),
    documents: r.documents.map((d) => ({
      id: d.doc_type,
      label: d.label,
      status: d.status as WorkerDocument['status'],
      note: d.note ?? undefined,
    })),
  };
}

export async function fetchMyProfile(): Promise<WorkerProfileSummary> {
  const data = await apiFetch<MeResponse>('/me');
  return fromApi(data);
}

export async function uploadDocument(docType: string, file: File): Promise<void> {
  const body = await file.arrayBuffer();
  await apiFetch(`/me/documents/${docType}/upload`, {
    method: 'POST',
    body,
    raw: { contentType: file.type || 'application/octet-stream' },
  });
}
