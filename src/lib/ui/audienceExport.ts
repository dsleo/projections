import type { AnalysisResult } from '@/lib/pipeline/client';

type AudienceTab = 'A' | 'B' | 'C' | 'D';

const AUDIENCE_LABELS: Record<AudienceTab, string> = {
  A: 'Domain expert',
  B: 'Adjacent researcher',
  C: 'Graduate student',
  D: 'Author notes',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return 'untitled';
  return trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 80) || 'untitled';
}

function formatParagraphs(value: string) {
  const escaped = escapeHtml(value);
  if (!escaped) return '';
  const paragraphs = escaped.split(/\n{2,}/g).map((p) => p.replace(/\n/g, '<br/>'));
  return paragraphs.map((p) => `<p>${p}</p>`).join('\n');
}

function renderList(items: string[]) {
  if (!items || items.length === 0) return '<p class="projections-empty">None.</p>';
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');
  return `<ul>${lis}</ul>`;
}

function renderGroundedList(items: Array<{ text: string }>) {
  if (!items || items.length === 0) return '<p class="projections-empty">None.</p>';
  const lis = items.map((item) => `<li>${escapeHtml(item.text)}</li>`).join('\n');
  return `<ul>${lis}</ul>`;
}

function textList(items: string[]) {
  if (!items || items.length === 0) return 'None.';
  return items.map((item) => `- ${item}`).join('\n');
}

function textGroundedList(items: Array<{ text: string }>) {
  if (!items || items.length === 0) return 'None.';
  return items.map((item) => `- ${item.text}`).join('\n');
}

const BASE_CSS = `
.projections-audience { font-family: "Inter", sans-serif; color: #111827; line-height: 1.6; }
.projections-audience h2 { font-family: "Poppins", sans-serif; font-size: 1.4rem; margin: 0 0 0.5rem; }
.projections-audience h3 { font-family: "Poppins", sans-serif; font-size: 1.05rem; margin: 1.2rem 0 0.4rem; }
.projections-audience h4 { font-size: 0.95rem; margin: 0.8rem 0 0.35rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
.projections-audience p { margin: 0.2rem 0 0.6rem; }
.projections-audience ul { margin: 0.2rem 0 0.8rem 1.2rem; padding: 0; }
.projections-audience li { margin: 0 0 0.35rem; }
.projections-meta { font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem; }
.projections-empty { color: #9ca3af; font-style: italic; }
`.trim();

export function buildAudienceExport(params: {
  result: AnalysisResult;
  documentTitle: string;
  audienceTab: AudienceTab;
  renderReadingPathText: (value: string) => string;
}) {
  const { result, documentTitle, audienceTab, renderReadingPathText } = params;
  const views = result.audience_views;
  if (!views) {
    return {
      text: '',
      snippet: '',
      html: '',
      filenameBase: `audience-${audienceTab}-untitled`,
    };
  }

  const label = AUDIENCE_LABELS[audienceTab];
  const filenameBase = `audience-${audienceTab}-${slugify(documentTitle)}`;
  const titleLine = `${documentTitle}\nAudience view: ${label}\n`;

  let text = `${titleLine}\n`;
  let body = `<section class="projections-audience">\n`;
  body += `<header>\n<h2>${escapeHtml(documentTitle)}</h2>\n`;
  body += `<div class="projections-meta">Audience view: ${escapeHtml(label)}</div>\n</header>\n`;

  if (audienceTab === 'A') {
    const v = views.domain_expert;
    text += `## Problem statement\n${v.problem_statement?.text ?? ''}\n\n`;
    text += `## What changes\n${textGroundedList(v.delta_summary)}\n\n`;
    text += `## Technical highlights\nNonstandard ideas\n${textGroundedList(
      v.technical_highlights.nonstandard_ideas
    )}\n\nKey reductions\n${textGroundedList(v.technical_highlights.clever_reductions)}\n\n`;
    text += `## Reusable constructions\n${textGroundedList(v.reusable_components)}\n\n`;

    body += `<section>\n<h3>Problem statement</h3>\n${formatParagraphs(
      v.problem_statement?.text ?? ''
    )}\n</section>\n`;
    body += `<section>\n<h3>What changes</h3>\n${renderGroundedList(
      v.delta_summary
    )}\n</section>\n`;
    body += `<section>\n<h3>Technical highlights</h3>\n<h4>Nonstandard ideas</h4>\n${renderGroundedList(
      v.technical_highlights.nonstandard_ideas
    )}\n<h4>Key reductions</h4>\n${renderGroundedList(
      v.technical_highlights.clever_reductions
    )}\n</section>\n`;
    body += `<section>\n<h3>Reusable constructions</h3>\n${renderGroundedList(
      v.reusable_components
    )}\n</section>\n`;
  } else if (audienceTab === 'B') {
    const v = views.adjacent_researcher;
    const prereq = v.prerequisite_map.map(renderReadingPathText);
    const read = v.reading_path.read.map(renderReadingPathText);
    const skim = v.reading_path.skim.map(renderReadingPathText);
    const skip = v.reading_path.skip.map(renderReadingPathText);

    text += `## Problem statement (plain math)\n${v.problem_statement?.text ?? ''}\n\n`;
    text += `## Why this matters\n${textGroundedList(v.why_matters)}\n\n`;
    text += `## Prerequisites\n${textList(prereq)}\n\n`;
    text += `## Reading path\nRead closely\n${textList(read)}\n\nSkim\n${textList(skim)}\n\nSkip for now\n${textList(skip)}\n\n`;

    body += `<section>\n<h3>Problem statement (plain math)</h3>\n${formatParagraphs(
      v.problem_statement?.text ?? ''
    )}\n</section>\n`;
    body += `<section>\n<h3>Why this matters</h3>\n${renderGroundedList(
      v.why_matters
    )}\n</section>\n`;
    body += `<section>\n<h3>Prerequisites</h3>\n${renderList(prereq)}\n</section>\n`;
    body += `<section>\n<h3>Reading path</h3>\n<h4>Read closely</h4>\n${renderList(
      read
    )}\n<h4>Skim</h4>\n${renderList(skim)}\n<h4>Skip for now</h4>\n${renderList(skip)}\n</section>\n`;
  } else if (audienceTab === 'C') {
    const v = views.grad_student;
    const read = v.reading_path.read.map(renderReadingPathText);
    const skim = v.reading_path.skim.map(renderReadingPathText);
    const skip = v.reading_path.skip.map(renderReadingPathText);

    text += `## Problem statement\n${v.problem_statement?.text ?? ''}\n\n`;
    text += `## Key ideas before details\n${textGroundedList(v.key_ideas)}\n\n`;
    text += `## Reading path\nRead closely\n${textList(read)}\n\nSkim\n${textList(skim)}\n\nSkip for now\n${textList(skip)}\n\n`;

    body += `<section>\n<h3>Problem statement</h3>\n${formatParagraphs(
      v.problem_statement?.text ?? ''
    )}\n</section>\n`;
    body += `<section>\n<h3>Key ideas before details</h3>\n${renderGroundedList(
      v.key_ideas
    )}\n</section>\n`;
    body += `<section>\n<h3>Reading path</h3>\n<h4>Read closely</h4>\n${renderList(
      read
    )}\n<h4>Skim</h4>\n${renderList(skim)}\n<h4>Skip for now</h4>\n${renderList(skip)}\n</section>\n`;
  } else {
    const v = views.author_self;
    text += `## Problem statement\n${v.problem_statement?.text ?? ''}\n\n`;
    text += `## Contribution summary\n${v.one_page_summary}\n\n`;
    text += `## Author notes\n${textList(v.notes_to_self ?? [])}\n\n`;

    body += `<section>\n<h3>Problem statement</h3>\n${formatParagraphs(
      v.problem_statement?.text ?? ''
    )}\n</section>\n`;
    body += `<section>\n<h3>Contribution summary</h3>\n${formatParagraphs(
      v.one_page_summary
    )}\n</section>\n`;
    body += `<section>\n<h3>Author notes</h3>\n${renderList(
      v.notes_to_self ?? []
    )}\n</section>\n`;
  }

  body += `</section>`;

  const snippet = `<style>\n${BASE_CSS}\n</style>\n${body}`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)} - Audience view</title>
  <style>
${BASE_CSS}
  </style>
</head>
<body>
${body}
</body>
</html>`;

  return { text: text.trim(), snippet, html, filenameBase };
}
