'use client';

import { useEffect, useRef } from 'react';

let katexRenderPromise:
  | Promise<{ default: (el: HTMLElement, options: Record<string, unknown>) => void }>
  | null = null;

type Props = {
  text: string;
  className?: string;
};

export function MathText({ text, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = text;
    let cancelled = false;
    if (!katexRenderPromise) {
      katexRenderPromise = import('katex/contrib/auto-render');
    }
    katexRenderPromise.then(({ default: renderMathInElement }) => {
      if (cancelled || !ref.current) return;
      renderMathInElement(ref.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return <div ref={ref} className={className} />;
}
