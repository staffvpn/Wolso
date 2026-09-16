-- Ревизия прав. Три вещи разом:
--
-- 1. Убираем мёртвое право verifyDocuments. Оно лежит в JSON у всех ролей
--    с миграции 0002, но его нет ни в типе PermissionKey, ни в списке
--    галочек дашборда, и ни один роут его не проверяет.
--
-- 2. Убираем среднее значение 'confirm'. Задумка была «покажем лишний
--    вопрос перед действием», но сервер пропускал его наравне с 'yes'
--    (middleware/auth.ts), а дашборд рисовал по нему только плашку. То
--    есть галочка выглядела ограничением и им не была. Приводим к 'yes' —
--    это ровно то, как оно и работало.
--
-- 3. Разделяем накопившиеся свалки и добавляем права для того, что
--    построено после 0002. Главное: рассылка всем пользователям уезжает
--    из manageData в собственное право — разослать сообщение всей базе и
--    почистить тестовую статистику не должны быть одной галочкой.
--
-- Новые ключи: verifyEmployers, hideProfiles, handleComplaints,
-- managePromos, sendBroadcasts, viewTechHealth.

-- Мёртвое право — из всех ролей, включая нестандартные.
UPDATE roles SET permissions = json_remove(permissions, '$.verifyDocuments');

-- Несуществующее среднее состояние — к честному «да».
UPDATE roles SET permissions = json_set(permissions, '$.blockUsers', 'yes')
  WHERE json_extract(permissions, '$.blockUsers') = 'confirm';
UPDATE roles SET permissions = json_set(permissions, '$.approveVacancies', 'yes')
  WHERE json_extract(permissions, '$.approveVacancies') = 'confirm';

-- Роли, созданные вручную, не трогаем по существу: новые права выводим из
-- того, чем человек уже пользовался, чтобы после миграции у него не
-- пропал ни один экран. Те же соответствия зашиты в middleware/auth.ts
-- как запасной вариант — на случай, если воркер выкатили раньше этой SQL.
UPDATE roles SET permissions = json_set(
    permissions,
    '$.verifyEmployers',   COALESCE(json_extract(permissions, '$.approveVacancies'), 'no'),
    '$.hideProfiles',      COALESCE(json_extract(permissions, '$.blockUsers'), 'no'),
    '$.handleComplaints',  COALESCE(json_extract(permissions, '$.blockUsers'), 'no'),
    '$.sendBroadcasts',    COALESCE(json_extract(permissions, '$.manageData'), 'no'),
    '$.managePromos',      COALESCE(json_extract(permissions, '$.manageData'), 'no'),
    '$.viewTechHealth',    'yes'
  )
  WHERE is_system = 0;

-- Системные роли перезаписываем целиком — так видно всю матрицу разом.
UPDATE roles SET permissions = '{"approveVacancies":"yes","verifyEmployers":"yes","blockUsers":"yes","hideProfiles":"yes","handleComplaints":"yes","viewSupportChats":"yes","managePromos":"yes","sendBroadcasts":"yes","manageTeam":"yes","switchUserRole":"yes","viewTechHealth":"yes","manageData":"yes","refundsPayouts":"yes","changeCommission":"yes","transferOwnership":"yes"}'
  WHERE id = 'owner';

-- Админ: всё, кроме удаления данных, комиссии и передачи владения.
-- Рассылка выключена намеренно — включается галочкой, когда появится
-- человек, которому можно доверить сообщение всей базе.
UPDATE roles SET permissions = '{"approveVacancies":"yes","verifyEmployers":"yes","blockUsers":"yes","hideProfiles":"yes","handleComplaints":"yes","viewSupportChats":"yes","managePromos":"yes","sendBroadcasts":"no","manageTeam":"yes","switchUserRole":"yes","viewTechHealth":"yes","manageData":"no","refundsPayouts":"yes","changeCommission":"no","transferOwnership":"no"}'
  WHERE id = 'admin';

-- Модератор: очереди на разбор. blockUsers стоял 'confirm', то есть
-- фактически 'yes' — сохраняем это поведение, а не ужесточаем молча.
UPDATE roles SET permissions = '{"approveVacancies":"yes","verifyEmployers":"yes","blockUsers":"yes","hideProfiles":"yes","handleComplaints":"yes","viewSupportChats":"no","managePromos":"no","sendBroadcasts":"no","manageTeam":"no","switchUserRole":"no","viewTechHealth":"no","manageData":"no","refundsPayouts":"no","changeCommission":"no","transferOwnership":"no"}'
  WHERE id = 'moderator';

-- Поддержка: переписки и чтение. Жалобы читать может (чтение открыто
-- любому сотруднику), а закрывать их — нет.
UPDATE roles SET permissions = '{"approveVacancies":"no","verifyEmployers":"no","blockUsers":"no","hideProfiles":"no","handleComplaints":"no","viewSupportChats":"yes","managePromos":"no","sendBroadcasts":"no","manageTeam":"no","switchUserRole":"no","viewTechHealth":"no","manageData":"no","refundsPayouts":"no","changeCommission":"no","transferOwnership":"no"}'
  WHERE id = 'support';
