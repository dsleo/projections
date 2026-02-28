'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Search } from 'lucide-react';
import type { AnalysisResult } from '@/lib/pipeline/client';
import { MathText } from '@/components/MathText';
import { classNames } from '@/lib/ui/classNames';

type Props = {
  result: AnalysisResult | null;
  audienceTab: 'A' | 'B' | 'C' | 'D';
  setAudienceTab: (tab: 'A' | 'B' | 'C' | 'D') => void;
  statusKind: 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';
  onDownloadAudienceText: () => void;
  onDownloadAudienceHtml: () => void;
  focusSentences: (ids: number[]) => void;
  renderGroundedList: (items: Array<{ text: string; sentence_ids?: number[] }>) => React.ReactElement;
  renderReadingPathText: (text: string) => React.ReactElement;
  renderAudienceFullText: () => React.ReactElement | null;
  showSupportingText?: boolean;
  editable?: boolean;
  onUpdateAudienceViews?: (
    updater: (views: NonNullable<AnalysisResult['audience_views']>) => void
  ) => void;
};

export function AudienceViewsCard({
  result,
  audienceTab,
  setAudienceTab,
  statusKind,
  onDownloadAudienceText,
  onDownloadAudienceHtml,
  focusSentences,
  renderGroundedList,
  renderReadingPathText,
  renderAudienceFullText,
  showSupportingText = true,
  editable = false,
  onUpdateAudienceViews,
}: Props) {
  const exportDetailsRef = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = exportDetailsRef.current;
      if (!el || !el.open) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (el.contains(target)) return;
      el.open = false;
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const audienceViews = result?.audience_views;
  const exportDisabled = !audienceViews || statusKind === 'analyzing' || statusKind === 'uploading';
  const canEdit = Boolean(editable && onUpdateAudienceViews);
  const gradReadingPath = audienceViews?.grad_student?.reading_path ?? {
    read: [],
    skim: [],
    skip: [],
  };
  const applyUpdate = (updater: (views: NonNullable<AnalysisResult['audience_views']>) => void) => {
    if (!canEdit || !onUpdateAudienceViews) return;
    onUpdateAudienceViews(updater);
  };

  const EditableText = ({
    value,
    onSave,
    renderDisplay,
    className,
  }: {
    value: string;
    onSave: (next: string) => void;
    renderDisplay?: (val: string) => React.ReactElement;
    className?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    const commit = () => {
      const next = draft.trim();
      setEditing(false);
      if (next !== value) onSave(next);
    };

    if (!canEdit) {
      return renderDisplay ? renderDisplay(value) : <MathText text={value} />;
    }

    if (editing) {
      return (
        <textarea
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-base text-zinc-900"
          value={draft}
          rows={Math.max(2, Math.min(6, Math.ceil(draft.length / 80)))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
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

    return (
      <span
        className={classNames('block', className)}
        onDoubleClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {renderDisplay ? renderDisplay(value) : <MathText text={value} />}
      </span>
    );
  };

  const renderEditableGroundedList = (
    items: Array<{ text: string; sentence_ids?: number[] }>,
    onUpdateItem: (views: NonNullable<AnalysisResult['audience_views']>, idx: number, value: string) => void
  ) => (
    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
      {items.map((item, idx) => (
        <li key={`aud-edit-${idx}`} className="mb-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <EditableText
                value={item.text}
                onSave={(next) => applyUpdate((views) => onUpdateItem(views, idx, next))}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 shrink-0">
              {item.sentence_ids && item.sentence_ids.length > 0 && (
                <button
                  className="rounded-full border px-2 py-0.5 text-sm hover:bg-white"
                  type="button"
                  onClick={() => focusSentences(item.sentence_ids ?? [])}
                  aria-label="Focus highlighted sentences in PDF"
                  title="Focus highlighted sentences in PDF"
                >
                  <Search className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );

  const renderEditableStringList = (
    items: string[],
    onUpdateItem: (views: NonNullable<AnalysisResult['audience_views']>, idx: number, value: string) => void,
    renderDisplay?: (value: string) => React.ReactElement
  ) => (
    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
      {items.map((item, idx) => (
        <li key={`aud-str-${idx}`} className="mb-2">
          <EditableText
            value={item}
            onSave={(next) => applyUpdate((views) => onUpdateItem(views, idx, next))}
            renderDisplay={renderDisplay}
          />
        </li>
      ))}
    </ul>
  );

  const renderGroundedListMaybe = (
    items: Array<{ text: string; sentence_ids?: number[] }>,
    onUpdateItem: (views: NonNullable<AnalysisResult['audience_views']>, idx: number, value: string) => void
  ) => (canEdit ? renderEditableGroundedList(items, onUpdateItem) : renderGroundedList(items));

  const renderStringListMaybe = (
    items: string[],
    onUpdateItem: (views: NonNullable<AnalysisResult['audience_views']>, idx: number, value: string) => void,
    renderDisplay?: (value: string) => React.ReactElement
  ) =>
    canEdit ? (
      renderEditableStringList(items, onUpdateItem, renderDisplay)
    ) : (
      <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
        {items.map((item, idx) => (
          <li key={`aud-str-${idx}`} className="mb-2">
            {renderDisplay ? renderDisplay(item) : <MathText text={item} />}
          </li>
        ))}
      </ul>
    );

  const renderContributionSummary = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return <MathText text={value} />;
    const tokens = trimmed.split(
      /\b(Main results|Technical core|Optimality|Methods|Results|Conclusion)\s*:/gi
    );
    if (tokens.length < 2) {
      return <MathText text={value} />;
    }
    const sections: Array<{ title: string; body: string }> = [];
    for (let i = 1; i < tokens.length; i += 2) {
      const title = tokens[i].trim();
      const body = (tokens[i + 1] ?? '').trim();
      if (!title || !body) continue;
      sections.push({ title, body });
    }
    if (sections.length === 0) return <MathText text={value} />;
    const capitalizeFirst = (input: string) => {
      if (!input) return input;
      return input[0].toUpperCase() + input.slice(1);
    };
    return (
      <div className="flex flex-col gap-3">
        {sections.map((section, idx) => (
          <div key={`${section.title}-${idx}`}>
            <div className="text-base font-semibold text-zinc-600">{section.title}</div>
            <div className="mt-1 text-base text-zinc-900">
              <MathText text={capitalizeFirst(section.body)} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 text-sm text-[color:var(--ink)]">
      {!audienceViews && <div className="text-sm text-[color:var(--muted)]">No data.</div>}
      {audienceViews && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'A', label: 'Domain Expert' },
                { id: 'B', label: 'Adjacent-field Researcher' },
                { id: 'C', label: 'Grad Student' },
                { id: 'D', label: 'Author Self' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={
                    audienceTab === tab.id
                      ? 'rounded-full border border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-1 text-sm text-white'
                      : 'rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-sm text-[color:var(--muted)] hover:bg-[color:var(--accent-soft)]'
                  }
                  onClick={() => setAudienceTab(tab.id as typeof audienceTab)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <details className="relative" ref={exportDetailsRef}>
                <summary
                  className={`list-none rounded-full border border-[color:var(--border)] px-3 py-1 text-sm font-normal text-[color:var(--muted)] hover:bg-[color:var(--accent-soft)] [&::-webkit-details-marker]:hidden flex items-center gap-2 ${exportDisabled ? 'opacity-50' : ''
                    }`}
                  aria-label="Download summaries"
                  title="Download summaries"
                  onClick={(e) => {
                    if (exportDisabled) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Download</span>
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-[color:var(--border)] bg-white p-1 text-base shadow">
                  <button
                    className="block w-full rounded px-2 py-2 text-left text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] disabled:text-zinc-300"
                    type="button"
                    onClick={() => {
                      if (exportDetailsRef.current) exportDetailsRef.current.open = false;
                      onDownloadAudienceText();
                    }}
                    disabled={exportDisabled}
                  >
                    Download TXT
                  </button>
                  <button
                    className="block w-full rounded px-2 py-2 text-left text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] disabled:text-zinc-300"
                    type="button"
                    onClick={() => {
                      if (exportDetailsRef.current) exportDetailsRef.current.open = false;
                      onDownloadAudienceHtml();
                    }}
                    disabled={exportDisabled}
                  >
                    Download HTML
                  </button>
                </div>
              </details>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-white/80 p-4 text-sm">
            {audienceTab === 'A' && (
              <>
                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Problem statement
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1 text-sm text-[color:var(--ink)]">
                      <EditableText
                        value={audienceViews.domain_expert.problem_statement?.text ?? ''}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.domain_expert.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[color:var(--muted)] shrink-0">
                      {audienceViews.domain_expert.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-sm hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.domain_expert.problem_statement!.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          <Search className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Delta summary
                  </div>
                  {renderGroundedListMaybe(audienceViews.domain_expert.delta_summary, (views, idx, next) => {
                    views.domain_expert.delta_summary[idx].text = next;
                  })}
                </div>

                {(audienceViews.domain_expert.technical_highlights.nonstandard_ideas.length > 0 ||
                  audienceViews.domain_expert.technical_highlights.clever_reductions.length > 0) && (
                    <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                        Technical highlights
                      </div>
                      {audienceViews.domain_expert.technical_highlights.nonstandard_ideas.length >
                        0 && (
                          <>
                            <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">
                              Nonstandard ideas
                            </div>
                            {renderGroundedListMaybe(
                              audienceViews.domain_expert.technical_highlights.nonstandard_ideas,
                              (views, idx, next) => {
                                views.domain_expert.technical_highlights.nonstandard_ideas[idx].text =
                                  next;
                              }
                            )}
                          </>
                        )}
                      {audienceViews.domain_expert.technical_highlights.clever_reductions.length >
                        0 && (
                          <>
                            <div className="mt-3 text-sm font-semibold text-[color:var(--muted)]">
                              Clever reductions
                            </div>
                            {renderGroundedListMaybe(
                              audienceViews.domain_expert.technical_highlights.clever_reductions,
                              (views, idx, next) => {
                                views.domain_expert.technical_highlights.clever_reductions[idx].text =
                                  next;
                              }
                            )}
                          </>
                        )}
                    </div>
                  )}

                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Reusable components
                  </div>
                  {renderGroundedListMaybe(audienceViews.domain_expert.reusable_components, (views, idx, next) => {
                    views.domain_expert.reusable_components[idx].text = next;
                  })}
                </div>
              </>
            )}

            {audienceTab === 'B' && (
              <>
                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Problem statement
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1 text-sm text-[color:var(--ink)]">
                      <EditableText
                        value={audienceViews.adjacent_researcher.problem_statement.text}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.adjacent_researcher.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[color:var(--muted)] shrink-0">
                      {audienceViews.adjacent_researcher.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-sm hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.adjacent_researcher.problem_statement.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          <Search className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Why this matters
                  </div>
                  {renderGroundedListMaybe(
                    audienceViews.adjacent_researcher.why_matters,
                    (views, idx, next) => {
                      views.adjacent_researcher.why_matters[idx].text = next;
                    }
                  )}
                </div>

                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Prerequisite map
                  </div>
                  {renderStringListMaybe(
                    audienceViews.adjacent_researcher.prerequisite_map,
                    (views, idx, next) => {
                      views.adjacent_researcher.prerequisite_map[idx] = next;
                    },
                    renderReadingPathText
                  )}
                </div>

                <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Reading path
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">Read</div>
                  {renderStringListMaybe(
                    audienceViews.adjacent_researcher.reading_path.read,
                    (views, idx, next) => {
                      views.adjacent_researcher.reading_path.read[idx] = next;
                    },
                    renderReadingPathText
                  )}
                  <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">Skim</div>
                  {renderStringListMaybe(
                    audienceViews.adjacent_researcher.reading_path.skim,
                    (views, idx, next) => {
                      views.adjacent_researcher.reading_path.skim[idx] = next;
                    },
                    renderReadingPathText
                  )}
                  <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">Skip</div>
                  {renderStringListMaybe(
                    audienceViews.adjacent_researcher.reading_path.skip,
                    (views, idx, next) => {
                      views.adjacent_researcher.reading_path.skip[idx] = next;
                    },
                    renderReadingPathText
                  )}
                </div>
              </>
            )}

            {audienceTab === 'C' && (
              <>
                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Problem statement
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1 text-sm text-[color:var(--ink)]">
                      <EditableText
                        value={audienceViews.grad_student.problem_statement?.text ?? ''}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.grad_student.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[color:var(--muted)] shrink-0">
                      {audienceViews.grad_student.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-sm hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.grad_student.problem_statement!.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          <Search className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Reading path
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">Read</div>
                  {renderStringListMaybe(
                    gradReadingPath.read,
                    (views, idx, next) => {
                      if (!views.grad_student.reading_path) {
                        views.grad_student.reading_path = { read: [], skim: [], skip: [] };
                      }
                      views.grad_student.reading_path.read[idx] = next;
                    },
                    renderReadingPathText
                  )}
                  <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">Skim</div>
                  {renderStringListMaybe(
                    gradReadingPath.skim,
                    (views, idx, next) => {
                      if (!views.grad_student.reading_path) {
                        views.grad_student.reading_path = { read: [], skim: [], skip: [] };
                      }
                      views.grad_student.reading_path.skim[idx] = next;
                    },
                    renderReadingPathText
                  )}
                  <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">Skip</div>
                  {renderStringListMaybe(
                    gradReadingPath.skip,
                    (views, idx, next) => {
                      if (!views.grad_student.reading_path) {
                        views.grad_student.reading_path = { read: [], skim: [], skip: [] };
                      }
                      views.grad_student.reading_path.skip[idx] = next;
                    },
                    renderReadingPathText
                  )}
                </div>

                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Key ideas before technicalities
                  </div>
                  {renderGroundedListMaybe(audienceViews.grad_student.key_ideas, (views, idx, next) => {
                    views.grad_student.key_ideas[idx].text = next;
                  })}
                </div>
              </>
            )}

            {audienceTab === 'D' && (
              <>
                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Problem statement
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1 text-sm text-[color:var(--ink)]">
                      <EditableText
                        value={audienceViews.author_self.problem_statement?.text ?? ''}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.author_self.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[color:var(--muted)] shrink-0">
                      {audienceViews.author_self.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-sm hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.author_self.problem_statement!.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          <Search className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Contribution Summary
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--ink)]">
                    <EditableText
                      value={audienceViews.author_self.one_page_summary}
                      renderDisplay={renderContributionSummary}
                      onSave={(next) =>
                        applyUpdate((views) => {
                          views.author_self.one_page_summary = next;
                        })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--paper)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Notes to self
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--ink)]">
                    <EditableText
                      value={audienceViews.author_self.notes_to_self?.[0] ?? ''}
                      renderDisplay={(val) =>
                        val.trim() ? (
                          <MathText text={val} />
                        ) : (
                          <span className="text-zinc-400 italic">Double click to add a note…</span>
                        )
                      }
                      onSave={(next) =>
                        applyUpdate((views) => {
                          const trimmed = next.trim();
                          views.author_self.notes_to_self = trimmed ? [trimmed] : [];
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          {showSupportingText && (
            <details className="rounded-2xl border border-[color:var(--border)] bg-white/80">
              <summary className="cursor-pointer px-3 py-2 text-base font-semibold text-[color:var(--muted)]">
                Supporting text
              </summary>
              {renderAudienceFullText()}
            </details>
          )}
        </>
      )}
    </div>
  );
}
