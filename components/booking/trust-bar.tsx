type TrustBarProps = {
  items: string[];
};

export function TrustBar({ items }: TrustBarProps) {
  return (
    <ul className="flex w-full max-w-[min(100%,56rem)] flex-wrap items-center justify-center gap-x-[clamp(0.75rem,3vw,1.75rem)] gap-y-2 px-1">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-1.5 text-[clamp(0.7rem,2.4vw,0.82rem)] text-white/78"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0 text-white/70"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          >
            <path d="M3.2 8.2 6.4 11.3 12.8 4.7" />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
