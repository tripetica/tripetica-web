type TrustBarProps = {
  items: string[];
};

export function TrustBar({ items }: TrustBarProps) {
  return (
    <ul className="trust-bar">
      {items.map((item) => (
        <li key={item} className="trust-bar-item">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="trust-bar-icon"
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
