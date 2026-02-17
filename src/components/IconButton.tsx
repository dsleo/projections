import type { LucideIcon } from 'lucide-react';

import { classNames } from '@/lib/ui/classNames';

type Props = {
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
    href?: string;
    download?: string;
    disabled?: boolean;
    variant?: 'default' | 'ghost';
    size?: 'sm' | 'md';
    className?: string;
};

export function IconButton({
    icon: Icon,
    label,
    onClick,
    href,
    download,
    disabled,
    variant = 'default',
    size = 'md',
    className,
}: Props) {
    const base =
        'inline-flex items-center justify-center rounded-full border text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:hover:bg-transparent';
    const sizes = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
    const styles =
        variant === 'ghost' ? 'border-transparent hover:bg-zinc-100' : 'border-zinc-200 bg-white';
    const cls = classNames(base, sizes, styles, className);

    if (href) {
        return (
            <a
                className={cls}
                href={href}
                download={download}
                aria-label={label}
                title={label}
            >
                <Icon className="h-4 w-4" aria-hidden />
            </a>
        );
    }

    return (
        <button
            className={cls}
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
        >
            <Icon className="h-4 w-4" aria-hidden />
        </button>
    );
}
