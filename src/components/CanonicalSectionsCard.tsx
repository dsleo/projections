'use client';

import React from 'react';
import { Copy, RefreshCw, Search } from 'lucide-react';

import type { AnalysisResult, CanonicalSections, DiscourseLabel } from '@/lib/pipeline/client';
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
  onRerunPass3?: () => void;
  editable?: boolean;
  dirty?: boolean;
  onUpdateSections?: (next: CanonicalSections) => void;
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
  onRerunPass3,
  editable = false,
  dirty = false,
  onUpdateSections,
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
  const emptyText = showProcessingEmpty ? 'Building this section…' : 'No explicit evidence found.';

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

  function EditableText({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
  }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value);

    React.useEffect(() => {
      if (editing) return;
      setDraft(value);
    }, [value, editing]);

    if (!editable) return <MathText text={value} />;

    if (!editing) {
      return (
        <div
          className="whitespace-pre-wrap"
          onDoubleClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          title="Double-click to edit locally"
        >
          {value ? <MathText text={value} /> : <span className="text-zinc-400">{placeholder ?? '—'}</span>}
        </div>
      );
    }

    return (
      <textarea
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
        value={draft}
        rows={Math.max(2, Math.min(8, Math.ceil(draft.length / 90)))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        autoFocus
      />
    );
  }

  const applyUpdate = (updater: (next: CanonicalSections) => void) => {
    if (!result?.sections) return;
    if (!onUpdateSections) return;
    const next = JSON.parse(JSON.stringify(result.sections)) as CanonicalSections;
    updater(next);
    onUpdateSections(next);
  };

  return (
    <details ref={detailsRef} className="group rounded-2xl border border-[color:var(--border)] bg-white/80" open>
      <summary className="flex cursor-pointer items-center border-b border-[color:var(--border)] px-4 py-3 text-sm font-semibold">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span>Structured outline</span>
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="inline-flex items-center gap-1"
            >
              <IconButton
                icon={RefreshCw}
                label="Rebuild outline"
                onClick={onRerunPass2}
                disabled={!result || status.kind === 'analyzing' || status.kind === 'uploading'}
                size="sm"
              />
              <IconButton
                icon={Copy}
                label="Copy outline JSON"
                onClick={() => {
                  if (!result?.sections) return;
                  onCopyCanonical();
                }}
                disabled={!result?.sections}
                size="sm"
              />
              {dirty && onRerunPass3 && (
                <IconButton
                  icon={RefreshCw}
                  label="Regenerate summaries"
                  onClick={onRerunPass3}
                  disabled={!result || status.kind === 'analyzing' || status.kind === 'uploading'}
                  size="sm"
                />
              )}
            </span>
          </span>
          {headerStatus && (
            <span className="text-xs font-normal text-[color:var(--muted)]">{headerStatus}</span>
          )}
        </div>
      </summary>

      <div className="grid grid-cols-1 gap-4 p-4">
        {!result && <div className="text-sm text-[color:var(--muted)]">No analysis yet.</div>}
        {result && (
          <>
            {dirty && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                The outline has local edits. Regenerate summaries to update the reader views.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'problem', label: 'Problem Framing' },
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.problem_and_motivation.central_problems[idx].description =
                                    next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.problem_and_motivation.origins[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.problem_and_motivation.nontriviality[idx].description =
                                    next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.landscape.known_results[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.landscape.limitations[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.landscape.competing_approaches[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.statement}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.contributions.contributions[idx].statement = next;
                                })
                              }
                            />
                            {editable && (
                              <div className="mt-2 flex flex-col gap-2">
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                                    Prior state
                                  </div>
                                  <EditableText
                                    value={item.prior_state.text}
                                    onChange={(next) =>
                                      applyUpdate((sections) => {
                                        sections.contributions.contributions[idx].prior_state.text =
                                          next;
                                      })
                                    }
                                    placeholder="Optional detail"
                                  />
                                </div>
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                                    Novelty
                                  </div>
                                  <EditableText
                                    value={item.novelty.text}
                                    onChange={(next) =>
                                      applyUpdate((sections) => {
                                        sections.contributions.contributions[idx].novelty.text = next;
                                      })
                                    }
                                    placeholder="Optional detail"
                                  />
                                </div>
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                                    Nontriviality
                                  </div>
                                  <EditableText
                                    value={item.nontriviality.text}
                                    onChange={(next) =>
                                      applyUpdate((sections) => {
                                        sections.contributions.contributions[idx].nontriviality.text =
                                          next;
                                      })
                                    }
                                    placeholder="Optional detail"
                                  />
                                </div>
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.technical_core.key_ideas[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.technical_core.technical_obstacles[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.technical_core.reusable_constructions[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.consequences.open_questions[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                            <EditableText
                              value={item.description}
                              onChange={(next) =>
                                applyUpdate((sections) => {
                                  sections.consequences.speculative_extensions[idx].description = next;
                                })
                              }
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="sr-only">sentence IDs {formatIdRanges(item.sentence_ids)}</span>
                              <button
                                className={sentenceActionClass}
                                onClick={() => focusSentences(item.sentence_ids)}
                                type="button"
                                aria-label="Show supporting sentences in the PDF"
                                title="Show supporting sentences in the PDF"
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
                    renderEmpty('No citations found in the source.')}
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
                      Show all citations
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
