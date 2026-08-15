export function EmptyHistory({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="empty-g" x1="40" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ec4899" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect x="46" y="30" width="108" height="100" rx="16" fill="var(--color-surface-2)" stroke="url(#empty-g)" strokeWidth="2" />
      <path d="M64 58h72M64 76h72M64 94h44" stroke="var(--color-border)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="140" cy="112" r="26" fill="url(#empty-g)" />
      <path d="M132 112l6 6 12-12" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
