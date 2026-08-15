import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Target, AlertTriangle, Swords, Wrench, ListChecks, Wallet, Rocket, Copy, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScoreGauge } from '@/components/ScoreGauge';
import { SectionCard, BulletList, NumberedList } from '@/components/SectionCard';
import { MODES } from '@/data/modes';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { haptic } from '@/lib/telegram';
import type { AnalysisResult, Mode } from '@/types';

const MODE_COLOR: Record<Mode, string> = {
  praise: '#34d17c',
  criticize: '#f5a623',
  destroy: '#ef4d5e',
  monetize: '#fbbf24',
};

function ResultBody({ result, mode, ideaText }: { result: AnalysisResult; mode: Mode; ideaText: string }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const color = MODE_COLOR[mode];
  const meta = MODES[mode];

  function copyToClipboard() {
    const text = [
      `Идея: ${ideaText}`,
      `Режим: ${meta.label}`,
      `Вердикт: ${result.verdict} (${result.score}/100)`,
      '',
      '🎯 Кому это нужно',
      ...result.audience.map((x) => `• ${x}`),
      '',
      '⚠️ Почему могут не купить',
      ...result.risks.map((x) => `• ${x}`),
      '',
      '🥊 Конкуренты',
      ...result.competitors.map((x) => `• ${x}`),
      '',
      '🩹 Слабые места',
      ...result.weaknesses.map((x) => `• ${x}`),
      '',
      '✅ Что проверить до запуска',
      ...result.checklist.map((x) => `• ${x}`),
      '',
      '💰 Пример экономики',
      ...result.economics.map((x) => `${x.label}: ${x.value}`),
      '',
      '🚀 5 способов сделать лучше',
      ...result.improvements.map((x, i) => `${i + 1}. ${x}`),
    ].join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      haptic('light');
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-card p-5 mb-4 flex items-center gap-4"
        style={{ background: `linear-gradient(135deg, ${color}1f, transparent)`, border: `1px solid ${color}33` }}
      >
        <ScoreGauge score={result.score} color={color} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
            {meta.emoji} {result.scoreLabel}
          </p>
          <p className="font-bold text-[16px] leading-snug mt-0.5">{result.verdict}</p>
        </div>
      </motion.div>

      <div className="space-y-3">
        <SectionCard icon={<Target size={16} />} title="Кому это нужно" color={color}>
          <BulletList items={result.audience} color={color} />
        </SectionCard>
        <SectionCard icon={<AlertTriangle size={16} />} title="Почему могут не купить" color={color}>
          <BulletList items={result.risks} color={color} />
        </SectionCard>
        <SectionCard icon={<Swords size={16} />} title="Конкуренты" color={color}>
          <BulletList items={result.competitors} color={color} />
        </SectionCard>
        <SectionCard icon={<Wrench size={16} />} title="Слабые места" color={color}>
          <BulletList items={result.weaknesses} color={color} />
        </SectionCard>
        <SectionCard icon={<ListChecks size={16} />} title="Что проверить до запуска" color={color}>
          <BulletList items={result.checklist} color={color} />
        </SectionCard>
        <SectionCard icon={<Wallet size={16} />} title="Пример экономики" color={color}>
          <div className="space-y-2">
            {result.economics.map((line, i) => (
              <div key={i} className="flex items-center justify-between text-[14px]">
                <span className="text-text-muted">{line.label}</span>
                <span className="font-bold">{line.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard icon={<Rocket size={16} />} title="5 способов сделать лучше" color={color}>
          <NumberedList items={result.improvements} color={color} />
        </SectionCard>
      </div>

      <div className="flex gap-2.5 mt-5">
        <Button variant="dark" onClick={copyToClipboard} className="shrink-0">
          {copied ? <Check size={17} /> : <Copy size={17} />}
        </Button>
        <Button
          fullWidth
          onClick={() => {
            useAnalysisStore.getState().reset();
            navigate('/');
          }}
        >
          <RotateCcw size={17} />
          Разобрать другую идею
        </Button>
      </div>
    </div>
  );
}

export function Result() {
  const navigate = useNavigate();
  const idea = useAnalysisStore((s) => s.idea);
  const mode = useAnalysisStore((s) => s.mode);
  const result = useAnalysisStore((s) => s.result);

  useEffect(() => {
    if (!result) navigate('/', { replace: true });
  }, [result, navigate]);

  if (!result) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-5 pt-3 pb-2 safe-top shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full bg-surface-2 border border-border-soft flex items-center justify-center text-text-muted active:bg-surface-hover"
          aria-label="Назад"
        >
          <ArrowLeft size={16} />
        </button>
        <p className="font-bold text-[15px] truncate">Разбор идеи</p>
      </div>
      <ResultBody result={result} mode={mode} ideaText={idea} />
    </div>
  );
}

export function HistoryDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const loadDetail = useAnalysisStore((s) => s.loadHistoryDetail);
  const [state, setState] = useState<{ result: AnalysisResult; mode: Mode; ideaText: string } | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    loadDetail(Number(id)).then((detail) => {
      setState(detail ? { result: detail.result, mode: detail.mode, ideaText: detail.ideaText } : null);
    });
  }, [id, loadDetail]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-5 pt-3 pb-2 safe-top shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full bg-surface-2 border border-border-soft flex items-center justify-center text-text-muted active:bg-surface-hover"
          aria-label="Назад"
        >
          <ArrowLeft size={16} />
        </button>
        <p className="font-bold text-[15px] truncate">Разбор идеи</p>
      </div>
      {state === undefined && <div className="flex-1 flex items-center justify-center text-text-faint text-[14px]">Загружаем…</div>}
      {state === null && <div className="flex-1 flex items-center justify-center text-text-faint text-[14px]">Не удалось загрузить разбор</div>}
      {state && <ResultBody result={state.result} mode={state.mode} ideaText={state.ideaText} />}
    </div>
  );
}
