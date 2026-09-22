import { Award, Briefcase, Camera, ClipboardCheck, Clock, Flame, Heart, Megaphone, MessageSquare, Send, ShieldCheck, Sparkles, Star, Trophy, Users, Zap } from 'lucide-react';

/** Тот же набор имён, что и в админке (admin/src/lib/achievementIcons.ts)
 *  — держать их синхронными приходится руками, значения приходят
 *  строкой из воркера, а не импортом между приложениями. */
export const ACHIEVEMENT_ICONS: Record<string, typeof Award> = {
  Send, Briefcase, Camera, ClipboardCheck, Award, Zap, Users, Star, ShieldCheck, Sparkles, Clock, MessageSquare, Trophy, Megaphone, Heart, Flame,
};
