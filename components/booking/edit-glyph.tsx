export function EditGlyph({ className = "booking-edit-glyph" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
    >
      <path d="M12.5 20.5h8" />
      <path d="M16.85 4.15a2.05 2.05 0 0 1 2.9 2.9L8.2 18.6 4.5 19.5l.9-3.7 11.45-11.65Z" />
    </svg>
  );
}
