'use client';

import Link from 'next/link';

export function AppLogo({ className }: { className?: string }) {
    return (
        <Link
            href="/"
            className={
                className ??
                'inline-flex items-center rounded-md px-2 py-1 hover:bg-[color:var(--accent-soft)]'
            }
            aria-label="Go to homepage"
            title="Go to homepage"
        >
            <span
                className="text-lg font-semibold tracking-tight text-[color:var(--ink)]"
                style={{ fontFamily: 'var(--font-serif)' }}
            >
                FourFold
            </span>
        </Link>
    );
}
