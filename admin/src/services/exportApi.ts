import { apiDownload } from '@/lib/apiClient';

export type ExportDataset = 'seekers' | 'employers' | 'shifts' | 'applications';

export const EXPORT_LABEL: Record<ExportDataset, string> = {
  seekers: 'Соискатели',
  employers: 'Работодатели',
  shifts: 'Смены',
  applications: 'Отклики',
};

export async function downloadExport(dataset: ExportDataset): Promise<void> {
  await apiDownload(`/admin/export/${dataset}`, `wolso-${dataset}.csv`);
}
