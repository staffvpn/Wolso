INSERT INTO roles (id, name, description, is_system, color, permissions) VALUES
('owner', 'Owner', 'Всё, включая биллинг и передачу владения', 1, '#1fae63',
  '{"approveVacancies":"yes","blockUsers":"yes","verifyDocuments":"yes","viewSupportChats":"yes","refundsPayouts":"yes","changeCommission":"yes","manageTeam":"yes","transferOwnership":"yes"}'),
('admin', 'Админ', 'Пользователи, финансы, настройки платформы', 1, '#2563a8',
  '{"approveVacancies":"yes","blockUsers":"yes","verifyDocuments":"yes","viewSupportChats":"yes","refundsPayouts":"yes","changeCommission":"yes","manageTeam":"yes","transferOwnership":"no"}'),
('moderator', 'Модератор', 'Проверка вакансий, документов и жалоб', 1, '#6b6d76',
  '{"approveVacancies":"yes","blockUsers":"confirm","verifyDocuments":"yes","viewSupportChats":"no","refundsPayouts":"no","changeCommission":"no","manageTeam":"no","transferOwnership":"no"}'),
('support', 'Поддержка', 'Чтение профилей и переписок, ответы в тикетах', 1, '#6b6d76',
  '{"approveVacancies":"no","blockUsers":"no","verifyDocuments":"no","viewSupportChats":"yes","refundsPayouts":"no","changeCommission":"no","manageTeam":"no","transferOwnership":"no"}');
