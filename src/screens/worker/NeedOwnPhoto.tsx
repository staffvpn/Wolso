import { Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

/** Показывается вместо ленты, пока на анкете стоит картинка из Telegram.
 *
 *  При регистрации Wolso копирует фото из Telegram, поэтому формально оно
 *  есть у всех — и именно поэтому его никто не меняет: поле выглядит
 *  заполненным. А у половины там машина, кот или пейзаж, и работодатель,
 *  который выбирает человека на смену по лицу, такую анкету пролистывает.
 *  Человек при этом не понимает, почему его не зовут.
 *
 *  Как и ProfileHidden, это не тупик: остальное приложение на месте —
 *  смены, о которых уже договорились, чаты и отклики никуда не делись.
 *  Закрыт ровно тот экран, с которого уходят новые отклики, и сервер
 *  отказывает им же (см. applications.ts), чтобы просьба не была той,
 *  которую можно пролистать. */
export function NeedOwnPhoto() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-4 text-center safe-top safe-bottom">
      <div className="h-14 w-14 rounded-full bg-accent-soft flex items-center justify-center">
        <Camera size={26} className="text-accent" />
      </div>

      <div className="space-y-1.5">
        <h1 className="font-extrabold text-[20px]">Поставьте своё фото</h1>
        <p className="text-[14px] text-text-muted max-w-[300px] leading-relaxed">
          Сейчас на анкете фото из Telegram. Работодатель выбирает человека на смену по лицу — поэтому откликаться можно
          только со своим фото.
        </p>
      </div>

      <div className="w-full max-w-[320px] rounded-2xl bg-surface border border-border p-4 text-left">
        <p className="text-[13px] text-text-muted leading-relaxed">
          Обычное селфи при дневном свете, лицо видно — этого достаточно. Ни студии, ни делового костюма не нужно.
        </p>
      </div>

      <Button onClick={() => navigate('/w/profile/edit')}>
        <Camera size={17} /> Поставить фото
      </Button>

      <p className="text-[13px] text-text-faint max-w-[300px] leading-relaxed">
        Смены, о которых вы уже договорились, и чаты остались на месте.
      </p>
    </div>
  );
}
