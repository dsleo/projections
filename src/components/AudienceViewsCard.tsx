'use client';

import type React from 'react';
import { useMemo, useState } from 'react';
import type { AnalysisResult } from '@/lib/pipeline/client';
import { MathText } from '@/components/MathText';
import { classNames } from '@/lib/ui/classNames';

type Props = {
  result: AnalysisResult | null;
  audienceTab: 'A' | 'B' | 'C' | 'D';
  setAudienceTab: (tab: 'A' | 'B' | 'C' | 'D') => void;
  statusKind: 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';
  headerStatus?: React.ReactNode;
  onRerunPass3: () => void;
  onCopyAudienceViews: () => void;
  focusSentences: (ids: number[]) => void;
  renderGroundedList: (items: Array<{ text: string; sentence_ids?: number[] }>) => React.ReactElement;
  renderCitationActionForKeys: (keys: string[]) => React.ReactElement | null;
  getCitationsForSentenceIds: (ids: number[]) => Array<{ key: string }>;
  collectSentenceIds: (items: Array<{ sentence_ids?: number[] }>) => number[];
  renderReadingPathText: (text: string) => React.ReactElement;
  renderAudienceFullText: () => React.ReactElement | null;
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
  headerStatus,
  onRerunPass3,
  onCopyAudienceViews,
  focusSentences,
  renderGroundedList,
  renderCitationActionForKeys,
  getCitationsForSentenceIds,
  collectSentenceIds,
  renderReadingPathText,
  renderAudienceFullText,
  editable = false,
  onUpdateAudienceViews,
}: Props) {
  const audienceViews = result?.audience_views;
  const canEdit = Boolean(editable && onUpdateAudienceViews);
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
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
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

  const renderEditableGroundedList = useMemo(
    () =>
      (
        items: Array<{ text: string; sentence_ids?: number[] }>,
        onUpdateItem: (views: NonNullable<AnalysisResult['audience_views']>, idx: number, value: string) => void
      ) => (
        <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
          {items.map((item, idx) => (
            <li key={`aud-edit-${idx}`} className="mb-2">
              <EditableText
                value={item.text}
                onSave={(next) => applyUpdate((views) => onUpdateItem(views, idx, next))}
              />
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                {item.sentence_ids && item.sentence_ids.length > 0 && (
                  <button
                    className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                    type="button"
                    onClick={() => focusSentences(item.sentence_ids ?? [])}
                    aria-label="Focus highlighted sentences in PDF"
                    title="Focus highlighted sentences in PDF"
                  >
                    🔎
                  </button>
                )}
                {renderCitationActionForKeys(
                  item.sentence_ids
                    ? getCitationsForSentenceIds(item.sentence_ids).map((e) => e.key)
                    : []
                )}
              </div>
            </li>
          ))}
        </ul>
      ),
    [applyUpdate, focusSentences, getCitationsForSentenceIds, renderCitationActionForKeys]
  );

  const renderEditableStringList = useMemo(
    () =>
      (
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
      ),
    [applyUpdate]
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

  return (
    <details className="rounded-lg border bg-white" open>
      <summary className="flex cursor-pointer items-center border-b px-4 py-3 text-sm font-semibold">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span>Audience views</span>
            <button
              className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRerunPass3();
              }}
              disabled={!result || statusKind === 'analyzing' || statusKind === 'uploading'}
              aria-label="Re-run Pass 3"
              title="Re-run Pass 3"
            >
              ⟳
            </button>
            <button
              className="rounded-full border px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!audienceViews) return;
                onCopyAudienceViews();
              }}
              aria-label="Copy audience view JSON"
              title="Copy audience view JSON"
            >
              ⧉
            </button>
          </span>
          {headerStatus && (
            <span className="text-xs font-normal text-zinc-500">{headerStatus}</span>
          )}
        </div>
      </summary>
      <div className="grid grid-cols-1 gap-4 p-4">
        {!audienceViews && <div className="text-sm text-zinc-500">No data.</div>}
        {audienceViews && (
          <>
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
                      ? 'rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs text-white'
                      : 'rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50'
                  }
                  onClick={() => setAudienceTab(tab.id as typeof audienceTab)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="rounded-md border bg-white p-3 max-h-[42vh] overflow-auto">
              {audienceTab === 'A' && (
                <>
                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Problem statement
                    </div>
                    <div className="mt-2 text-sm text-zinc-900">
                      <EditableText
                        value={audienceViews.domain_expert.problem_statement?.text ?? ''}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.domain_expert.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      {audienceViews.domain_expert.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.domain_expert.problem_statement!.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          🔎
                        </button>
                      ) : null}
                      {renderCitationActionForKeys(
                        getCitationsForSentenceIds(
                          audienceViews.domain_expert.problem_statement?.sentence_ids ?? []
                        ).map((e) => e.key)
                      )}
                    </div>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Delta summary
                    </div>
                    {renderGroundedListMaybe(audienceViews.domain_expert.delta_summary, (views, idx, next) => {
                      views.domain_expert.delta_summary[idx].text = next;
                    })}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Technical highlights
                    </div>
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Nonstandard ideas</div>
                    {renderGroundedListMaybe(
                      audienceViews.domain_expert.technical_highlights.nonstandard_ideas,
                      (views, idx, next) => {
                        views.domain_expert.technical_highlights.nonstandard_ideas[idx].text = next;
                      }
                    )}
                    <div className="mt-3 text-xs font-semibold text-zinc-500">
                      Clever reductions
                    </div>
                    {renderGroundedListMaybe(
                      audienceViews.domain_expert.technical_highlights.clever_reductions,
                      (views, idx, next) => {
                        views.domain_expert.technical_highlights.clever_reductions[idx].text = next;
                      }
                    )}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
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
                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Problem statement (plain math)
                    </div>
                    <div className="mt-2 text-sm text-zinc-900">
                      <EditableText
                        value={audienceViews.adjacent_researcher.problem_statement.text}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.adjacent_researcher.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      {audienceViews.adjacent_researcher.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.adjacent_researcher.problem_statement.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          🔎
                        </button>
                      ) : null}
                      {renderCitationActionForKeys(
                        getCitationsForSentenceIds(
                          audienceViews.adjacent_researcher.problem_statement.sentence_ids ?? []
                        ).map((e) => e.key)
                      )}
                    </div>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Why this matters
                    </div>
                    {renderGroundedListMaybe(
                      audienceViews.adjacent_researcher.why_matters,
                      (views, idx, next) => {
                        views.adjacent_researcher.why_matters[idx].text = next;
                      }
                    )}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
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

                  <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Reading path
                    </div>
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Read</div>
                    {renderStringListMaybe(
                      audienceViews.adjacent_researcher.reading_path.read,
                      (views, idx, next) => {
                        views.adjacent_researcher.reading_path.read[idx] = next;
                      },
                      renderReadingPathText
                    )}
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Skim</div>
                    {renderStringListMaybe(
                      audienceViews.adjacent_researcher.reading_path.skim,
                      (views, idx, next) => {
                        views.adjacent_researcher.reading_path.skim[idx] = next;
                      },
                      renderReadingPathText
                    )}
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Skip</div>
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
                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Problem statement
                    </div>
                    <div className="mt-2 text-sm text-zinc-900">
                      <EditableText
                        value={audienceViews.grad_student.problem_statement?.text ?? ''}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.grad_student.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      {audienceViews.grad_student.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.grad_student.problem_statement!.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          🔎
                        </button>
                      ) : null}
                      {renderCitationActionForKeys(
                        getCitationsForSentenceIds(
                          audienceViews.grad_student.problem_statement?.sentence_ids ?? []
                        ).map((e) => e.key)
                      )}
                    </div>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Conceptual map
                    </div>
                    {renderStringListMaybe(
                      audienceViews.grad_student.conceptual_map,
                      (views, idx, next) => {
                        views.grad_student.conceptual_map[idx] = next;
                      },
                      renderReadingPathText
                    )}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Suggested first pass
                    </div>
                    {renderStringListMaybe(
                      audienceViews.grad_student.suggested_first_pass,
                      (views, idx, next) => {
                        views.grad_student.suggested_first_pass[idx] = next;
                      },
                      renderReadingPathText
                    )}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Key ideas before technicalities
                    </div>
                    {renderGroundedListMaybe(audienceViews.grad_student.key_ideas, (views, idx, next) => {
                      views.grad_student.key_ideas[idx].text = next;
                    })}
                    {renderCitationActionForKeys(
                      getCitationsForSentenceIds(
                        collectSentenceIds(audienceViews.grad_student.key_ideas)
                      ).map((e) => e.key)
                    )}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      What to ignore initially
                    </div>
                    {renderStringListMaybe(
                      audienceViews.grad_student.ignore_initially,
                      (views, idx, next) => {
                        views.grad_student.ignore_initially[idx] = next;
                      },
                      renderReadingPathText
                    )}
                  </div>

                  <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Permission to skip
                    </div>
                    <div className="mt-2 text-sm text-zinc-900">
                      <EditableText
                        value={audienceViews.grad_student.permission_to_skip}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.grad_student.permission_to_skip = next;
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {audienceTab === 'D' && (
                <>
                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Problem statement
                    </div>
                    <div className="mt-2 text-sm text-zinc-900">
                      <EditableText
                        value={audienceViews.author_self.problem_statement?.text ?? ''}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.author_self.problem_statement.text = next;
                          })
                        }
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      {audienceViews.author_self.problem_statement?.sentence_ids?.length ? (
                        <button
                          className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                          type="button"
                          onClick={() =>
                            focusSentences(
                              audienceViews.author_self.problem_statement!.sentence_ids
                            )
                          }
                          aria-label="Focus highlighted sentences in PDF"
                          title="Focus highlighted sentences in PDF"
                        >
                          🔎
                        </button>
                      ) : null}
                      {renderCitationActionForKeys(
                        getCitationsForSentenceIds(
                          audienceViews.author_self.problem_statement?.sentence_ids ?? []
                        ).map((e) => e.key)
                      )}
                    </div>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      One-page contribution summary
                    </div>
                    <div className="mt-2 text-sm text-zinc-900">
                      <EditableText
                        value={audienceViews.author_self.one_page_summary}
                        onSave={(next) =>
                          applyUpdate((views) => {
                            views.author_self.one_page_summary = next;
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Fragile arguments
                    </div>
                    {renderGroundedListMaybe(audienceViews.author_self.fragile_arguments, (views, idx, next) => {
                      views.author_self.fragile_arguments[idx].text = next;
                    })}
                    {renderCitationActionForKeys(
                      getCitationsForSentenceIds(
                        collectSentenceIds(audienceViews.author_self.fragile_arguments)
                      ).map((e) => e.key)
                    )}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Robust arguments
                    </div>
                    {renderGroundedListMaybe(audienceViews.author_self.robust_arguments, (views, idx, next) => {
                      views.author_self.robust_arguments[idx].text = next;
                    })}
                    {renderCitationActionForKeys(
                      getCitationsForSentenceIds(
                        collectSentenceIds(audienceViews.author_self.robust_arguments)
                      ).map((e) => e.key)
                    )}
                  </div>

                  <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Notes to self
                    </div>
                    {renderStringListMaybe(
                      audienceViews.author_self.notes_to_self,
                      (views, idx, next) => {
                        views.author_self.notes_to_self[idx] = next;
                      }
                    )}
                  </div>
                </>
              )}
            </div>
            <details className="rounded-md border bg-white">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-600">
                Supporting text
              </summary>
              {renderAudienceFullText()}
            </details>
          </>
        )}
      </div>
    </details>
  );
}
