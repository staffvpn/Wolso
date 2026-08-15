import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { ModePicker } from '@/components/ModePicker';
import { Button } from '@/components/ui/Button';
import { HeroBrain } from '@/components/illustrations/HeroBrain';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { MODES } from '@/data/modes';
import { IDEA_EXAMPLES } from '@/data/examples';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { usePaywallStore } from '@/store/usePaywallStore';
import { haptic, hapticNotify } from '@/lib/telegram';

const MAX_LEN = 500;

export function Home() {
  const navigate = useNavigate();
  const idea = useAnalysisStore((s) => s.idea);
  const setIdea = useAnalysisStore((s) => s.setIdea);
  const mode = useAnalysisStore((s) => s.mode);
  const setMode = useAnalysisStore((s) => s.setMode);
  const status = useAnalysisStore((s) => s.status);
  const analyze = useAnalysisStore((s) => s.analyze);

  const entitlement = useEntitlementStore((s) => s.entitlement);
  const entitlementLoaded = useEntitlementStore((s) => s.loaded);
  const loadEntitlement = useEntitlementStore((s) => s.load);
  const openPaywall = usePaywallStore((s) => s.openPaywall);

  const placeholder = useMemo(() => IDEA_EXAMPLES[Math.floor(Math.random() * IDEA_EXAMPLES.length)], []);
  const [focused, setFocused] = useState(false);
  const meta = MODES[mode];
  const canSubmit = idea.trim().length >= 8;

  useEffect(() => {
    if (!entitlementLoaded) loadEntitlement();
  }, [entitlementLoaded, loadEntitlement]);

  async function handleSubmit() {
    if (!canSubmit) return;
    if (entitlement && !entitlement.canAnalyze) {
      haptic('medium');
      openPaywall();
      return;
    }
    haptic('medium');
    const outcome = await analyze();
    if (outcome === 'ok') {
      hapticNotify('success');
      navigate('/result');
    } else if (outcome === 'payment_required') {
      openPaywall();
    } else {
      hapticNotify('error');
    }
  }

  if (status === 'loading') return <LoadingOverlay mode={mode} />;

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar />

      <div className="flex-1 overflow-y-auto px-5 pb-6 safe-bottom">
        <div className="flex justify-center py-1">
          <HeroBrain className="w-[220px] h-[150px]" />
        </div>

        <div className="text-center space-y-1.5 mb-5">
          <h1 className="text-[22px] font-extrabold tracking-tight">Разнеси мою идею</h1>
          <p className="text-[14px] text-text-muted leading-relaxed px-2">
            Опиши бизнес-идею в паре предложений — разберём её жёстко и по делу
          </p>
        </div>

        <div
          className="rounded-card bg-surface border p-3.5 mb-4 transition-colors"
          style={{ borderColor: focused ? 'var(--color-accent)' : 'var(--color-border-soft)' }}
        >
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value.slice(0, MAX_LEN))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={`Например: «${placeholder}»`}
            rows={4}
            className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed placeholder:text-text-faint"
          />
          <div className="flex justify-end">
            <span className="text-[11px] text-text-faint">{idea.length}/{MAX_LEN}</span>
          </div>
        </div>

        <p className="text-[12px] font-bold text-text-faint uppercase tracking-wide mb-2 px-0.5">Режим разбора</p>
        <ModePicker value={mode} onChange={setMode} />
        <p className="text-[13px] text-text-muted mt-3 px-0.5 leading-relaxed">{meta.description}</p>

        <div className="mt-6 space-y-3">
          <EntitlementPill />
          <Button fullWidth size="lg" disabled={!canSubmit} onClick={handleSubmit}>
            <Sparkles size={18} />
            {meta.verb}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntitlementPill() {
  const entitlement = useEntitlementStore((s) => s.entitlement);
  if (!entitlement) return null;

  if (entitlement.isPro) {
    return (
      <p className="text-center text-[12px] font-semibold text-accent">👑 Pro-подписка — безлимит разборов</p>
    );
  }
  if (entitlement.freeAvailable) {
    return <p className="text-center text-[12px] font-semibold text-text-muted">🎁 Первый разбор — бесплатно</p>;
  }
  if (entitlement.credits > 0) {
    return (
      <p className="text-center text-[12px] font-semibold text-text-muted">
        ⭐ Доступно разборов: {entitlement.credits}
      </p>
    );
  }
  return <p className="text-center text-[12px] font-semibold text-text-faint">🔒 79 ⭐ за следующий разбор</p>;
}
