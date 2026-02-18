'use client';

import type React from 'react';
import { Copy, RefreshCw, Search } from 'lucide-react';

import type { AnalysisResult, DiscourseLabel } from '@/lib/pipeline/client';
import { MathText } from '@/components/MathText';
import { IconButton } from '@/components/IconButton';
import type { AnalyzeStatus } from '@/lib/ui/useAnalyzeStream';

type Props = {
  result: AnalysisResult | null;
  detailsRef: React.RefObject<HTMLDetailsElement | null>;
  activeTab: 'problem' | 'landscape' | 'contrib' | 'tech' | 'cons' | 'cites';
  setActiveTab: (tab: 'problem' | 'landscape' | 'contrib' | 'tech' | 'cons' | 'cites') => void;
  status: AnalyzeStatus;
  headerStatus?: React.ReactNode;
  onRerunPass2: () => void;
  onCopyCanonical: () => void;
  renderEmpty: (label: string) => React.ReactElement;
  renderCitationAction: (ids: number[]) => React.ReactElement | null;
  focusSentences: (ids: number[]) => void;
  formatIdRanges: (ids: number[]) => string;
  formatCitationLabel: (entry: AnalysisResult['citations'][string]) => string;
  LabelPill: React.ComponentType<{ label: DiscourseLabel }>;
  focusedCitationKeys: string[];
  setFocusedCitationKeys: (keys: string[]) => void;
  showSentenceActions?: boolean;
};

export function CanonicalSectionsCard({
  result,
  detailsRef,
  activeTab,
  setActiveTab,
  status,
  headerStatus,
  onRerunPass2,
  onCopyCanonical,
  renderEmpty,
  renderCitationAction,
  focusSentences,
  formatIdRanges,
  formatCitationLabel,
  LabelPill,
  focusedCitationKeys,
  setFocusedCitationKeys,
  showSentenceActions = true,
}: Props) {
  const showProcessingEmpty =
    status.kind === 'uploading' ||
    (status.kind === 'analyzing' && (status.phase === 'pass1' || status.phase === 'pass2'));
  const emptyText = showProcessingEmpty ? 'Processing…' : 'No explicit items found.';

  const sentenceActionClass = showSentenceActions
    ? 'rounded-full border px-2 py-0.5 text-[10px] hover:bg-white'
    : 'hidden';
  const problem = result?.sections.problem_and_motivation;
  const landscape = result?.sections.landscape;
  const contributions = result?.sections.contributions;
  const technical = result?.sections.technical_core;
  const consequences = result?.sections.consequences;

  const landscapeKnown = landscape?.known_results ?? [];
  const landscapeLimitations = landscape?.limitations ?? [];
  const landscapeCompeting = landscape?.competing_approaches ?? [];
  const technicalKeyIdeas = technical?.key_ideas ?? [];
  const technicalObstacles = technical?.technical_obstacles ?? [];
  const technicalReusable = technical?.reusable_constructions ?? [];
  const consequenceOpen = consequences?.open_questions ?? [];
  const consequenceSpec = consequences?.speculative_extensions ?? [];

  return (
    <details ref={detailsRef} className="rounded-lg border bg-white" open>
      <summary className="flex cursor-pointer items-center border-b px-4 py-3 text-sm font-semibold">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span>Canonical sections</span>
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="inline-flex items-center gap-1"
            >
              <IconButton
                icon={RefreshCw}
                label="Re-run Pass 2"
                onClick={onRerunPass2}
                disabled={!result || status.kind === 'analyzing' || status.kind === 'uploading'}
                size="sm"
              />
              <IconButton
                icon={Copy}
                label="Copy canonical JSON"
                onClick={() => {
                  if (!result?.sections) return;
                  onCopyCanonical();
                }}
                disabled={!result?.sections}
                size="sm"
              />
            </span>
          </span>
          {headerStatus && (
            <span className="text-xs font-normal text-zinc-500">{headerStatus}</span>
          )}
        </div>
      </summary>

      <div className="grid grid-cols-1 gap-4 p-4">
        {!result && <div className="text-sm text-zinc-500">No data.</div>}
        {result && (
          <>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'problem', label: 'Problem & Motivation' },
                { id: 'landscape', label: 'Landscape' },
                { id: 'contrib', label: 'Contributions' },
                { id: 'tech', label: 'Technical Core' },
                { id: 'cons', label: 'Consequences' },
                { id: 'cites', label: 'Citations' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={
                    activeTab === tab.id
                      ? 'rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs text-white'
                      : 'rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50'
                  }
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="rounded-md border bg-white p-3 max-h-[55vh] overflow-auto">
              {activeTab === 'problem' && problem && (
                <>
                  {problem.central_problems.length === 0 &&
                    problem.origins.length === 0 &&
                    problem.nontriviality.length === 0 &&
                    renderEmpty(emptyText)}
                  {problem.central_problems.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Central problem
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {problem.central_problems.map((item, idx) => (
                          <li key={`pm-cp-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {problem.origins.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Origins
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {problem.origins.map((item, idx) => (
                          <li key={`pm-or-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {problem.nontriviality.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Nontriviality
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {problem.nontriviality.map((item, idx) => (
                          <li key={`pm-nt-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'landscape' && landscape && (
                <>
                  {landscapeKnown.length === 0 &&
                    landscapeLimitations.length === 0 &&
                    landscapeCompeting.length === 0 &&
                    renderEmpty(emptyText)}
                  {landscapeKnown.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Known result
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {landscapeKnown.map((item, idx) => (
                          <li key={`ls-kr-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {landscapeLimitations.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Limitations
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {landscapeLimitations.map((item, idx) => (
                          <li key={`ls-lim-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {landscapeCompeting.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Competing approach
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {landscapeCompeting.map((item, idx) => (
                          <li key={`ls-rel-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'contrib' && contributions && (
                <>
                  {contributions.contributions.length === 0 && renderEmpty(emptyText)}
                  {contributions.contributions.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {contributions.contributions.map((item, idx) => (
                          <li key={`contrib-${idx}`} className="mb-3">
                            <MathText text={item.statement} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'tech' && technical && (
                <>
                  {technicalKeyIdeas.length === 0 &&
                    technicalObstacles.length === 0 &&
                    technicalReusable.length === 0 &&
                    renderEmpty(emptyText)}
                  {technicalKeyIdeas.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Key idea
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {technicalKeyIdeas.map((item, idx) => (
                          <li key={`tc-cm-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {technicalObstacles.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Technical obstacle
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {technicalObstacles.map((item, idx) => (
                          <li key={`tc-ks-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {technicalReusable.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Reusable construction
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {technicalReusable.map((item, idx) => (
                          <li key={`tc-rc-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'cons' && consequences && (
                <>
                  {consequenceOpen.length === 0 &&
                    consequenceSpec.length === 0 &&
                    renderEmpty(emptyText)}
                  {consequenceOpen.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Open questions
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {consequenceOpen.map((item, idx) => (
                          <li key={`cons-oq-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {consequenceSpec.length > 0 && (
                    <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Speculative extensions
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                        {consequenceSpec.map((item, idx) => (
                          <li key={`cons-se-${idx}`} className="mb-2">
                            <MathText text={item.description} />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Focus highlighted sentences in PDF"
                                title="Focus highlighted sentences in PDF"
                              >
                                <Search className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {renderCitationAction(item.sentence_ids)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'cites' && (
                <>
                  {Object.keys(result.citations ?? {}).length === 0 &&
                    renderEmpty('No citations detected.')}
                  {(focusedCitationKeys.length > 0
                    ? focusedCitationKeys
                      .map((key) => result.citations?.[key])
                      .filter(Boolean)
                    : Object.values(result.citations ?? {})
                  ).map((entry) => (
                    <div
                      key={`cite-${entry.key}`}
                      className={
                        focusedCitationKeys.includes(entry.key)
                          ? 'mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm'
                          : 'mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2 text-sm'
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-900">
                          {formatCitationLabel(entry)}
                        </span>
                        {entry.labels.map((l) => (
                          <LabelPill key={`${entry.key}-${l}`} label={l} />
                        ))}
                      </div>
                      {entry.text && <div className="mt-1 text-xs text-zinc-700">{entry.text}</div>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span>{entry.sentence_ids.length} sentences</span>
                        <button
                          className={sentenceActionClass}
                          onClick={() => focusSentences(entry.sentence_ids)}
                          type="button"
                          disabled={entry.sentence_ids.length === 0}
                        >
                          <Search className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))}
                  {focusedCitationKeys.length > 0 && (
                    <button
                      className="rounded-full border px-3 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
                      type="button"
                      onClick={() => setFocusedCitationKeys([])}
                    >
                      Clear filter
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
