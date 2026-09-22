import { Award, Briefcase, Camera, ClipboardCheck, Clock, Heart, Megaphone, MessageSquare, Send, ShieldCheck, Sparkles, Star, Trophy, Users, Zap } from 'lucide-react';

/** Тот же набор имён, что мини-апп и воркер знают по строке `icon` —
 *  закрытый список умышленно: свободный текст в базе означал бы, что
 *  опечатка в форме молча ничего не рисует вместо явной ошибки. */
export const ACHIEVEMENT_ICONS: Record<string, typeof Award> = {
  Send, Briefcase, Camera, ClipboardCheck, Award, Zap, Users, Star, ShieldCheck, Sparkles, Clock, MessageSquare, Trophy, Megaphone, Heart,
};
