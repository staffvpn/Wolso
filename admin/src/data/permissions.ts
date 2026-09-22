import type { PermissionInfo, RoleDef } from '@/types';

/** Каталог галочек на экране «Роли и права».
 *
 *  Порядок здесь — это порядок строк в таблице, поэтому права сгруппированы
 *  по смыслу: сначала ежедневные очереди, потом действия над людьми, потом
 *  площадка, и в конце служебное, которое выдают неохотно.
 *
 *  `hint` — вторая строка под названием. Нужна там, где по одному названию
 *  не видно последствий: «рассылка» звучит безобидно ровно до момента,
 *  когда сообщение уходит всей базе и не отзывается. */
export const PERMISSIONS: PermissionInfo[] = [
  { key: 'approveVacancies', label: 'Одобрять и отклонять вакансии', group: 'Очереди на разбор' },
  {
    key: 'verifyEmployers',
    label: 'Проверять работодателей',
    hint: 'Заявки с ИНН: подтвердить или отклонить заведение',
    group: 'Очереди на разбор',
  },
  { key: 'handleComplaints', label: 'Разбирать жалобы', hint: 'Читать жалобы может любой сотрудник, закрывать — по этой галочке', group: 'Очереди на разбор' },

  {
    key: 'hideProfiles',
    label: 'Скрывать анкеты',
    hint: 'Анкета пропадает из поиска, но человек продолжает пользоваться приложением',
    group: 'Действия над людьми',
  },
  {
    key: 'blockUsers',
    label: 'Блокировать пользователей',
    hint: 'Полная блокировка входа. Отдельно от скрытия анкеты',
    group: 'Действия над людьми',
  },
  { key: 'switchUserRole', label: 'Переключать роль пользователя', hint: 'Соискатель ↔ работодатель', group: 'Действия над людьми' },
  { key: 'viewSupportChats', label: 'Видеть переписки в поддержке', group: 'Действия над людьми' },

  { key: 'managePromos', label: 'Управлять рекламой', hint: 'Рекламные карточки в ленте смен', group: 'Площадка' },
  {
    key: 'manageAchievements',
    label: 'Управлять достижениями',
    hint: 'Бейджи соискателей: условия, включение и ручная выдача конкретному человеку',
    group: 'Площадка',
  },
  {
    key: 'sendBroadcasts',
    label: 'Рассылки всем пользователям',
    hint: 'Одно сообщение уходит всей базе и не отзывается',
    group: 'Площадка',
  },

  { key: 'manageTeam', label: 'Команда и роли', hint: 'Приглашать сотрудников и менять вот эти галочки', group: 'Служебное' },
  { key: 'viewTechHealth', label: 'Технический раздел', hint: 'Проверка миграций и состояния базы', group: 'Служебное' },
  { key: 'manageData', label: 'Удаление и экспорт данных', hint: 'Очистка статистики, выгрузка базы', group: 'Служебное' },
  { key: 'refundsPayouts', label: 'Возвраты и выплаты', hint: 'Пока не работает: денежная часть выключена', group: 'Служебное' },
  { key: 'changeCommission', label: 'Менять комиссию платформы', hint: 'Пока не работает: денежная часть выключена', group: 'Служебное' },
  {
    key: 'transferOwnership',
    label: 'Передача владения платформой',
    hint: 'Есть только у владельца и никому не выдаётся',
    group: 'Служебное',
  },
];

/** Roles themselves come from the API (`useRolesStore`) — this only has the
 *  static permission-key catalog and a lookup helper. */
export function roleById(id: string, roles: RoleDef[]): RoleDef {
  return roles.find((r) => r.id === id) ?? roles[roles.length - 1];
}

export function hasPermission(role: RoleDef, key: PermissionInfo['key']): boolean {
  return role.permissions[key] !== 'no';
}
