-- Блокировка из дашборда писала только status='suspended', и эту колонку
-- никто не проверял на стороне самого заблокированного — он продолжал
-- пользоваться приложением как ни в чём не бывало. Теперь блокировка
-- действительно закрывает доступ, а человеку показывается причина, чтобы
-- он не гадал, что случилось, и не шёл в поддержку с «у меня не работает».
--
-- Причина обязательна на уровне API (пустую строку роут не примет), но
-- колонка nullable: аккаунты, заблокированные до этой миграции, причины не
-- имеют, и им показывается общий текст.
ALTER TABLE workers ADD COLUMN suspended_reason TEXT;
ALTER TABLE workers ADD COLUMN suspended_at TEXT;
ALTER TABLE companies ADD COLUMN suspended_reason TEXT;
ALTER TABLE companies ADD COLUMN suspended_at TEXT;
