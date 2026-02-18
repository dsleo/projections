'use client';

import Link from 'next/link';

export function AppLogo({ className }: { className?: string }) {
    return (
        <Link
            href="/"
            className={
                className ??
                'inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-zinc-50'
            }
            aria-label="Go to homepage"
            title="Go to homepage"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fourfold-mark.svg" alt="FourFold" className="h-6 w-6" />
            <span
                className="text-lg font-semibold"
                style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontStyle: 'italic' }}
            >
                FourFold
            </span>
        </Link>
    );
}
