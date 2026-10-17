import Link from 'next/link';

export function Brand() {
  return (
    <Link aria-label="OpsPilot home" className="brand" href="/">
      <span aria-hidden="true" className="brand-mark">
        O
      </span>
      <span>OpsPilot</span>
    </Link>
  );
}
