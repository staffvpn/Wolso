-- Ревизия прав. Задача миграции — только завести новые ключи и убрать
-- мусор. Расстановку галочек она за владельца не решает: значения
-- выводятся из тех прав, внутри которых новое право раньше жило, так что
-- сразу после применения поведение ролей не меняется ни на шаг. Дальше
-- всё правится на экране «Роли и права».
--
-- 1. verifyDocuments лежит в JSON у всех ролей с миграции 0002, но его нет
--    ни в типе PermissionKey, ни в списке галочек, и ни один роут его не
--    проверяет. Мусор.
--
-- 2. Значение 'confirm' задумывалось как «пропустить, но показать лишний
--    вопрос». Сервер пропускал его наравне с 'yes' (middleware/auth.ts), а
--    вопрос показывать было некому: значение никто не читал, кроме плашки
--    на экране ролей. Приводим к 'yes' — это ровно то, как оно работало.
--
-- 3. Новые ключи: verifyEmployers, hideProfiles, handleComplaints,
--    managePromos, sendBroadcasts, viewTechHealth. Главное разделение —
--    рассылка всем пользователям уезжает из manageData в собственное
--    право: разослать сообщение всей базе и почистить тестовую статистику
--    не должны быть одной галочкой.

-- Мёртвое право — из всех ролей.
UPDATE roles SET permissions = json_remove(permissions, '$.verifyDocuments');

-- Несуществующее среднее состояние — к честному «да».
UPDATE roles SET permissions = json_set(permissions, '$.blockUsers', 'yes')
  WHERE json_extract(permissions, '$.blockUsers') = 'confirm';
UPDATE roles SET permissions = json_set(permissions, '$.approveVacancies', 'yes')
  WHERE json_extract(permissions, '$.approveVacancies') = 'confirm';

-- Новые права — всем ролям разом, со значением того старого права,
-- внутри которого новое раньше жило. Те же соответствия зашиты в
-- middleware/auth.ts как запасной вариант, на случай если воркер выкатили
-- раньше этой SQL.
UPDATE roles SET permissions = json_set(
    permissions,
    '$.verifyEmployers',   COALESCE(json_extract(permissions, '$.approveVacancies'), 'no'),
    '$.hideProfiles',      COALESCE(json_extract(permissions, '$.blockUsers'), 'no'),
    '$.handleComplaints',  COALESCE(json_extract(permissions, '$.blockUsers'), 'no'),
    '$.sendBroadcasts',    COALESCE(json_extract(permissions, '$.manageData'), 'no'),
    '$.managePromos',      COALESCE(json_extract(permissions, '$.manageData'), 'no'),
    '$.viewTechHealth',    'no'
  );

-- Единственное место, где значение задано, а не унаследовано: технический
-- раздел был открыт любому сотруднику, включая поддержку, и это решили
-- сузить до владельца и админа. Всё остальное — галочками в дашборде.
UPDATE roles SET permissions = json_set(permissions, '$.viewTechHealth', 'yes')
  WHERE id IN ('owner', 'admin');

-- У владельца должно быть всё: роль не редактируется в дашборде (иначе с
-- неё можно снять «команду и роли» и запереть себя снаружи админки), так
-- что недостающее ей может выдать только миграция.
UPDATE roles SET permissions = json_set(
    permissions,
    '$.verifyEmployers', 'yes',
    '$.hideProfiles', 'yes',
    '$.handleComplaints', 'yes',
    '$.sendBroadcasts', 'yes',
    '$.managePromos', 'yes',
    '$.viewTechHealth', 'yes'
  )
  WHERE id = 'owner';
