import Link from "next/link";

// The lens mark and wordmark, shown at the top of every page.
export default function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 self-start text-text no-underline">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="14" fill="none" stroke="var(--teal)" strokeWidth="2" />
        <circle cx="17" cy="17" r="6" fill="none" stroke="var(--orchid)" strokeWidth="2" />
        <path d="M17 0v8M17 26v8M0 17h8M26 17h8" stroke="var(--text)" strokeWidth="1.5" />
      </svg>
      <span className="font-display text-2xl font-extrabold tracking-tight">ExpiryLens</span>
    </Link>
  );
}
