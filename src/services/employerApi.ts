import type { Candidate, Vacancy } from '@/types';
import { CANDIDATES, VACANCIES } from '@/data/employer';
import { delay } from './delay';

export async function fetchVacancies(): Promise<Vacancy[]> {
  await delay();
  return VACANCIES;
}

export async function fetchCandidates(): Promise<Candidate[]> {
  await delay();
  return CANDIDATES;
}

/** Simulated POST /vacancies */
export async function createVacancy(input: Omit<Vacancy, 'id' | 'publishedMinAgo' | 'status' | 'reach'>): Promise<Vacancy> {
  await delay(400);
  return {
    ...input,
    id: `vac-${Date.now()}`,
    publishedMinAgo: 0,
    status: 'active',
    reach: Math.round(120 + Math.random() * 160),
  };
}
