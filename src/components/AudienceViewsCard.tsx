'use client';

import type React from 'react';
import type { AnalysisResult } from '@/lib/pipeline/client';
import { MathText } from '@/components/MathText';

type Props = {
  result: AnalysisResult | null;
  audienceTab: 'A' | 'B' | 'C' | 'D';
  setAudienceTab: (tab: 'A' | 'B' | 'C' | 'D') => void;
  statusKind: 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';
  onRerunPass3: () => void;
  onCopyAudienceViews: () => void;
  focusSentences: (ids: number[]) => void;
  renderGroundedList: (items: Array<{ text: string; sentence_ids?: number[] }>) => React.ReactElement;
  renderCitationActionForKeys: (keys: string[]) => React.ReactElement | null;
  getCitationsForSentenceIds: (ids: number[]) => Array<{ key: string }>;
  collectSentenceIds: (items: Array<{ sentence_ids?: number[] }>) => number[];
  renderReadingPathText: (text: string) => React.ReactElement;
  renderAudienceFullText: () => React.ReactElement | null;
};

export function AudienceViewsCard({
  result,
  audienceTab,
  setAudienceTab,
  statusKind,
  onRerunPass3,
  onCopyAudienceViews,
  focusSentences,
  renderGroundedList,
  renderCitationActionForKeys,
  getCitationsForSentenceIds,
  collectSentenceIds,
  renderReadingPathText,
  renderAudienceFullText,
}: Props) {
  const audienceViews = result?.audience_views;

  return (
    <details className="rounded-lg border bg-white" open>
      <summary className="flex cursor-pointer items-center border-b px-4 py-3 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <span>Audience views (Pass 3)</span>
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
                      <MathText text={audienceViews.domain_expert.problem_statement?.text ?? ''} />
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
                        >
                          View sentences
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
                    {renderGroundedList(audienceViews.domain_expert.delta_summary)}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Technical highlights
                    </div>
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Nonstandard ideas</div>
                    {renderGroundedList(
                      audienceViews.domain_expert.technical_highlights.nonstandard_ideas
                    )}
                    <div className="mt-3 text-xs font-semibold text-zinc-500">
                      Clever reductions
                    </div>
                    {renderGroundedList(
                      audienceViews.domain_expert.technical_highlights.clever_reductions
                    )}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Reusable components
                    </div>
                    {renderGroundedList(audienceViews.domain_expert.reusable_components)}
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
                      <MathText text={audienceViews.adjacent_researcher.problem_statement.text} />
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
                        >
                          View sentences
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
                    {renderGroundedList(audienceViews.adjacent_researcher.why_matters)}
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Prerequisite map
                    </div>
                    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.adjacent_researcher.prerequisite_map.map((item, idx) => (
                        <li key={`b-pre-${idx}`} className="mb-2">
                          {renderReadingPathText(item)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Reading path
                    </div>
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Read</div>
                    <ul className="mt-1 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.adjacent_researcher.reading_path.read.map((item, idx) => (
                        <li key={`b-read-${idx}`} className="mb-2">
                          {renderReadingPathText(item)}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Skim</div>
                    <ul className="mt-1 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.adjacent_researcher.reading_path.skim.map((item, idx) => (
                        <li key={`b-skim-${idx}`} className="mb-2">
                          {renderReadingPathText(item)}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-xs font-semibold text-zinc-500">Skip</div>
                    <ul className="mt-1 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.adjacent_researcher.reading_path.skip.map((item, idx) => (
                        <li key={`b-skip-${idx}`} className="mb-2">
                          {renderReadingPathText(item)}
                        </li>
                      ))}
                    </ul>
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
                      <MathText text={audienceViews.grad_student.problem_statement?.text ?? ''} />
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
                        >
                          View sentences
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
                    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.grad_student.conceptual_map.map((item, idx) => (
                        <li key={`c-map-${idx}`} className="mb-2">
                          {renderReadingPathText(item)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Suggested first pass
                    </div>
                    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.grad_student.suggested_first_pass.map((item, idx) => (
                        <li key={`c-pass-${idx}`} className="mb-2">
                          {renderReadingPathText(item)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Key ideas before technicalities
                    </div>
                    {renderGroundedList(audienceViews.grad_student.key_ideas)}
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
                    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.grad_student.ignore_initially.map((item, idx) => (
                        <li key={`c-ign-${idx}`} className="mb-2">
                          {renderReadingPathText(item)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Permission to skip
                    </div>
                    <div className="mt-2 text-sm text-zinc-900">
                      <MathText text={audienceViews.grad_student.permission_to_skip} />
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
                      <MathText text={audienceViews.author_self.problem_statement?.text ?? ''} />
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
                        >
                          View sentences
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
                      <MathText text={audienceViews.author_self.one_page_summary} />
                    </div>
                  </div>

                  <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      Fragile arguments
                    </div>
                    {renderGroundedList(audienceViews.author_self.fragile_arguments)}
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
                    {renderGroundedList(audienceViews.author_self.robust_arguments)}
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
                    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                      {audienceViews.author_self.notes_to_self.map((item, idx) => (
                        <li key={`d-note-${idx}`} className="mb-2">
                          <MathText text={item} />
                        </li>
                      ))}
                    </ul>
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
