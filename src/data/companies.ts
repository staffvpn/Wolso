import type { Company } from '@/types';

export const COMPANIES: Company[] = [
  { id: 'cofix', name: 'Cofix', address: 'Тверская 12', logoInitial: 'C', logoColor: '#34d17c', rating: 4.8, reviewsCount: 214, verified: true, inn: '770901' },
  { id: 'cheb1', name: 'Чебуречная №1', address: 'Арбат 2', logoInitial: 'Ч', logoColor: '#e8b23f', rating: 4.6, reviewsCount: 98, verified: true, inn: '770455' },
  { id: 'prozakat', name: 'Прозакат', address: 'Пятницкая 24', logoInitial: 'П', logoColor: '#5b8def', rating: 4.7, reviewsCount: 133, verified: true, inn: '771230' },
  { id: 'veranda', name: 'Веранда', address: 'Кутузовский 9', logoInitial: 'В', logoColor: '#ef4d5e', rating: 4.4, reviewsCount: 61, verified: false, inn: '772345' },
  { id: 'skuratov', name: 'Skuratov Coffee', address: 'Мясницкая 15', logoInitial: 'S', logoColor: '#a463f2', rating: 4.9, reviewsCount: 302, verified: true, inn: '773456' },
  { id: 'atmosphere', name: 'Кофейня «Атмосфера»', address: 'Покровка 5', logoInitial: 'А', logoColor: '#34d17c', rating: 4.5, reviewsCount: 76, verified: true, inn: '774567' },
  { id: 'mama-mia', name: 'Pizzeria Mama Mia', address: 'Ленинский 44', logoInitial: 'M', logoColor: '#e8834f', rating: 4.3, reviewsCount: 54, verified: false, inn: '775678' },
  { id: 'north-bar', name: 'Бар «Северный»', address: 'Никольская 8', logoInitial: 'С', logoColor: '#3fa7e8', rating: 4.7, reviewsCount: 189, verified: true, inn: '776789' },
  { id: 'zolotoy-kolos', name: 'Пекарня «Золотой колос»', address: 'Профсоюзная 61', logoInitial: 'З', logoColor: '#e8c93f', rating: 4.6, reviewsCount: 47, verified: true, inn: '777890' },
  { id: 'lucky-sushi', name: 'Lucky Sushi', address: 'Проспект Мира 33', logoInitial: 'L', logoColor: '#ef4d9e', rating: 4.2, reviewsCount: 88, verified: false, inn: '778901' },
];

export function getCompany(id: string): Company {
  const found = COMPANIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown company ${id}`);
  return found;
}
