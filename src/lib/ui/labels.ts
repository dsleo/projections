import type { DiscourseLabel } from '../pipeline/types';

export const LABEL_COLORS: Record<DiscourseLabel, string> = {
    Problem: 'bg-red-100 text-red-900 border-red-200',
    Landscape: 'bg-blue-100 text-blue-900 border-blue-200',
    Contribution: 'bg-green-100 text-green-900 border-green-200',
    TechnicalCore: 'bg-purple-100 text-purple-900 border-purple-200',
    Consequences: 'bg-amber-100 text-amber-900 border-amber-200',
};

export const LABEL_SWATCH: Record<DiscourseLabel, string> = {
    Problem: '#ef4444',
    Landscape: '#3b82f6',
    Contribution: '#22c55e',
    TechnicalCore: '#a855f7',
    Consequences: '#f59e0b',
};
