/** One label/value line in the expanded details of a shift — shared by
 *  «Мои смены» and «Мои отклики» so the two read identically when you
 *  open a card in either place. */
export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-text-faint shrink-0">{label}</span>
      <span className="text-text text-right min-w-0 truncate">{value}</span>
    </div>
  );
}
