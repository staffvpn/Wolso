/** Где человек нашёл смену, которую занёс себе сам. Список — площадки, на
 *  которых в России действительно ищут подработку в общепите и рознице,
 *  плюс два «нецифровых» варианта: по знакомым и напрямую в заведении —
 *  так находят чаще всего, и без них выбор пришлось бы подменять «другим».
 *
 *  Это подсказки, а не справочник: id уезжает в базу строкой, сервер
 *  ничего из этого не проверяет, и добавить сюда пункт можно не трогая
 *  схему. Незнакомое значение экран покажет как есть. */
export interface FoundViaOption {
  id: string;
  label: string;
}

export const FOUND_VIA_OPTIONS: FoundViaOption[] = [
  { id: 'telegram', label: 'Телеграм' },
  { id: 'avito', label: 'Авито' },
  { id: 'hh', label: 'hh.ru' },
  { id: 'superjob', label: 'SuperJob' },
  { id: 'rabota', label: 'Rabota.ru' },
  { id: 'zarplata', label: 'Zarplata.ru' },
  { id: 'vk', label: 'ВКонтакте' },
  { id: 'youla', label: 'Юла' },
  { id: 'friends', label: 'По знакомым' },
  { id: 'onsite', label: 'Пришёл в заведение' },
  { id: 'other', label: 'Другое' },
];

export function foundViaLabel(id: string): string {
  return FOUND_VIA_OPTIONS.find((o) => o.id === id)?.label ?? id;
}
