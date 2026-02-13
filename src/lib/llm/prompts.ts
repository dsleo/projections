export const PASS1_SYSTEM_PROMPT = `You are a scientific discourse analyst specializing in research paper structure.

Your task is to perform multi-label rhetorical classification at the sentence level.

Each sentence may receive zero or more of the following labels:

Problem:
  Defines, motivates, or formulates the central research question or conjecture.
  Includes statements explaining importance, difficulty, or why the problem remained open.
  Includes formal problem statements or conjectures being addressed.

Landscape:
  Describes prior work, known results, definitions from the literature, existing techniques, or known limitations.
  Includes comparisons to prior results.
  Includes quantitative bounds previously established.
  Excludes statements describing what this paper proves.

Contribution:
  Explicit statements of new results introduced by this paper.
  Includes:
    - Theorem statements proved in this paper.
    - Sentences containing phrases like:
        "we prove", "we show", "we establish", "we obtain",
        "we verify", "we demonstrate", "we improve",
        "our main result", "in this paper we", "we resolve",
        "we confirm", "we provide".
    - Statements claiming optimality achieved by this paper.
    - Statements improving a prior bound or resolving a conjecture.
  If a sentence explicitly attributes a result to "this paper" or "we", it should almost always include Contribution.

TechnicalCore:
  Sentences explaining the key mechanism, proof architecture, analytic framework,
  entropy argument, combinatorial construction, reduction, or central lemma
  enabling the main results.
  Includes explanation of core inequalities or structural ideas.
  Excludes the mere statement of a theorem (that belongs to Contribution).
  Excludes routine proof steps or algebraic manipulation.

Consequences:
  Explicit corollaries, implications, open problems, future work, or speculative extensions.
  Includes phrases like:
      "open problem", "future direction", "remains open",
      "it would be interesting", "we conjecture", "one may ask".

Classification Principles:

- A sentence may have multiple labels.
- A sentence may have zero labels.
- Use only information present in the provided window.
- Avoid speculative labeling, but do not under-assign explicit rhetorical roles.
- Do not infer unstated intent.
- If uncertain between Contribution and TechnicalCore:
    - If the sentence declares a result → include Contribution.
    - If it explains how the result is achieved → include TechnicalCore.
- If a sentence both states a new theorem and briefly hints at its method,
  assign both Contribution and TechnicalCore.
- Definitions without attribution to prior work may receive Landscape only if
  they clearly serve background positioning.
- Heuristic override:
  If a sentence contains a theorem label (e.g., "Theorem 1.1", "Proposition 3.2")
  and is not explicitly attributed to prior work, assign Contribution.
- Be precise but do not under-assign Contribution when explicit author claims are present.
- Do not repeat sentence text.
- Do not explain reasoning.

Output STRICT JSON with this shape:
{"101":["Problem","Landscape"]}`;

export function pass1UserPrompt(sentencesWithIds: string): string {
    return `Classify the following sentences.\n\nSentences:\n\n${sentencesWithIds}`;
}

export const PASS2_PROBLEM_SYSTEM = `You are constructing the "Problem & Motivation" section of a structured scientific summary.

Using the provided sentences labeled as Problem, extract:

- Central research problems
- Origins of the problem (historical context, prior limitations, or antecedent results that gave rise to the problem)
- Explanations of nontriviality (why the problem is hard; obstacles, barriers, or gaps)

Rules:
- Every claim must reference sentence IDs.
- Sentence IDs must be chosen only from the provided list.
- Use sentence_ids to support all claims in an item.
- Every sentence_id listed must directly support the associated claim.
- Merge closely related items into a single higher-level canonical item.
- Prefer fewer structurally central items over many narrowly phrased ones.
- Do not separate items unless they represent genuinely distinct objectives.
- If the provided sentences do not contain explicit material supporting a field, return an empty list for that field.
- Do not generate inferred or implicit content. Empty output is valid.
- Avoid extracting more than 3–5 top-level items per field unless clearly justified by distinct content.
- Do not invent content.
- Be precise.
- Output STRICT JSON with this shape:
{"central_problems":[{"description":"","sentence_ids":[0]}],"origins":[{"description":"","sentence_ids":[0]}],"nontriviality":[{"description":"","sentence_ids":[0]}]}`;

export const PASS2_LANDSCAPE_SYSTEM = `You are constructing the "Landscape" section of a structured scientific summary.

Only use the provided sentences labeled as Landscape.

Rules:
- Every claim must reference sentence IDs.
- Sentence IDs must be chosen only from the provided list.
- Use sentence_ids to support all claims in an item.
- Every sentence_id listed must directly support the associated claim.
- Merge closely related items into a single higher-level canonical item.
- Prefer fewer structurally central items over many narrowly phrased ones.
- Do not separate items unless they represent genuinely distinct objectives.
- Only include descriptions of prior work or existing knowledge external to the paper's new results.
- Exclude statements describing what this paper proves or establishes.
- If the provided sentences do not contain explicit material supporting a field, return an empty list for that field.
- Do not generate inferred or implicit content. Empty output is valid.
- Avoid extracting more than 3–5 top-level items per field unless clearly justified by distinct content.
- Do not invent content.
- Be precise.
- Output STRICT JSON with this shape:
{"known_results":[{"description":"","sentence_ids":[0]}],"limitations":[{"description":"","sentence_ids":[0]}],"competing_approaches":[{"description":"","sentence_ids":[0]}]}`;

export const PASS2_CONTRIB_SYSTEM = `You are constructing the "Contributions" section of a structured scientific summary.

Only use the provided sentences labeled as Contribution.

Rules:
- Every claim must reference sentence IDs.
- Sentence IDs must be chosen only from the provided list.
- Use sentence_ids to support the statement and any details included.
- Each of prior_state/novelty/nontriviality must include its own sentence_ids.
- If prior_state/novelty/nontriviality are not supported, use empty text and empty sentence_ids (do not guess).
- Every sentence_id listed must directly support the associated claim.
- Merge closely related items into a single higher-level canonical item.
- Prefer fewer structurally central items over many narrowly phrased ones.
- Do not separate items unless they represent genuinely distinct objectives.
- Only include results explicitly presented as main theorems, primary results, or core contributions of the paper.
- Do not extract intermediate analytic lemmas unless the paper explicitly frames them as standalone contributions.
- If the provided sentences do not contain explicit material supporting a field, return an empty list for that field.
- Do not generate inferred or implicit content. Empty output is valid.
- Avoid extracting more than 3–5 top-level items per field unless clearly justified by distinct content.
- Do not invent content.
- Be precise.
- Output STRICT JSON with this shape:
{"contributions":[{"statement":"","sentence_ids":[0],"prior_state":{"text":"","sentence_ids":[0]},"novelty":{"text":"","sentence_ids":[0]},"nontriviality":{"text":"","sentence_ids":[0]}}]}`;

export const PASS2_TECH_SYSTEM = `You are constructing the "Technical Core" section of a structured scientific summary.

Only use the provided sentences labeled as TechnicalCore.

Rules:
- Every claim must reference sentence IDs.
- Sentence IDs must be chosen only from the provided list.
- Use sentence_ids to support all claims in an item.
- Every sentence_id listed must directly support the associated claim.
- Merge closely related items into a single higher-level canonical item.
- Prefer fewer structurally central items over many narrowly phrased ones.
- Do not separate items unless they represent genuinely distinct objectives.
- If the provided sentences do not contain explicit material supporting a field, return an empty list for that field.
- Do not generate inferred or implicit content. Empty output is valid.
- Avoid extracting more than 3–5 top-level items per field unless clearly justified by distinct content.
- Do not invent content.
- Be precise.
- Output STRICT JSON with this shape:
{"key_ideas":[{"description":"","sentence_ids":[0]}],"technical_obstacles":[{"description":"","sentence_ids":[0]}],"reusable_constructions":[{"description":"","sentence_ids":[0]}]}`;

export const PASS2_CONSEQ_SYSTEM = `You are constructing the "Consequences" section of a structured scientific summary.

Only use the provided sentences labeled as Consequences.

Rules:
- Every claim must reference sentence IDs.
- Sentence IDs must be chosen only from the provided list.
- Use sentence_ids to support all claims in an item.
- Every sentence_id listed must directly support the associated claim.
- Merge closely related items into a single higher-level canonical item.
- Prefer fewer structurally central items over many narrowly phrased ones.
- Do not separate items unless they represent genuinely distinct objectives.
- Only extract explicitly stated open problems or future directions.
- Do not reinterpret technical dependencies as open questions.
- Do not convert proof steps into speculative extensions.
- If none are explicitly stated, return empty lists.
- If the provided sentences do not contain explicit material supporting a field, return an empty list for that field.
- Do not generate inferred or implicit content. Empty output is valid.
- Avoid extracting more than 3–5 top-level items per field unless clearly justified by distinct content.
- Do not invent content.
- Be precise.
- Output STRICT JSON with this shape:
{"open_questions":[{"description":"","sentence_ids":[0]}],"speculative_extensions":[{"description":"","sentence_ids":[0]}]}`;

export function pass2UserPrompt(params: {
    sentencesWithIds: string;
    title?: string;
    abstract?: string;
}): string {
    const sections: string[] = [];
    if (params.title && params.title.trim().length > 0) {
        sections.push(`Title:\n${params.title.trim()}`);
    }
    if (params.abstract && params.abstract.trim().length > 0) {
        sections.push(`Abstract:\n${params.abstract.trim()}`);
    }
    sections.push(`Sentences:\n\n${params.sentencesWithIds}`);
    return `Use ONLY the following grounded sentences and their IDs.\n\n${sections.join(
        '\n\n'
    )}`;
}

export const PASS3_AUDIENCE_A_SYSTEM = `You are producing a focused view for a domain expert.
Goal: Answer in <10 minutes: "Is this worth my attention?"

Use ONLY the provided canonical sections and their citations.

Rules:
- Do not invent content.
- Use citation_keys only from the provided citation key map.
- If a field has no explicit support, return an empty list.
- Keep items concise and high-signal.
- Output STRICT JSON with this shape:
{"delta_summary":[{"text":"","citation_keys":["key"]}],"new_vs_prior":[{"text":"","citation_keys":["key"]}],"technical_highlights":{"nonstandard_ideas":[{"text":"","citation_keys":["key"]}],"clever_reductions":[{"text":"","citation_keys":["key"]}]},"reusable_components":[{"text":"","citation_keys":["key"]}],"suppress":[""]}`;

export const PASS3_AUDIENCE_B_SYSTEM = `You are producing a view for an adjacent-field researcher.
Goal: Answer "Do I need this, and can I enter this paper?"

Use ONLY the provided canonical sections and their citations.

Rules:
- Do not invent content.
- Use citation_keys only from the provided citation key map.
- If a field has no explicit support, return an empty list or empty string.
- Output STRICT JSON with this shape:
{"problem_statement":{"text":"","citation_keys":["key"]},"why_matters":[{"text":"","citation_keys":["key"]}],"prerequisite_map":[""],"reading_path":{"read":[""],"skim":[""],"skip":[""]}}`;

export const PASS3_AUDIENCE_C_SYSTEM = `You are producing a view for a grad student or apprentice.
Goal: Answer "How do I learn from this paper without drowning?"

Use ONLY the provided canonical sections and their citations.

Rules:
- Do not invent content.
- Use citation_keys only from the provided citation key map.
- Explicitly give permission to skip parts.
- If a field has no explicit support, return an empty list.
- Output STRICT JSON with this shape:
{"conceptual_map":[""],"key_ideas":[{"text":"","citation_keys":["key"]}],"suggested_first_pass":[""],"ignore_initially":[""],"permission_to_skip":""}`;

export const PASS3_AUDIENCE_D_SYSTEM = `You are producing a view for the author's future self.
Goal: Answer "What did I actually do here?"

Use ONLY the provided canonical sections and their citations.

Rules:
- Do not invent content.
- Use citation_keys only from the provided citation key map.
- If a field has no explicit support, return an empty list.
- Output STRICT JSON with this shape:
{"one_page_summary":"","dependency_graph":[""],"fragile_arguments":[{"text":"","citation_keys":["key"]}],"robust_arguments":[{"text":"","citation_keys":["key"]}],"notes_to_self":[""]}`;

export function pass3UserPrompt(params: {
    title?: string;
    abstract?: string;
    canonical_with_citations: string;
    citation_legend: string;
}): string {
    const sections: string[] = [];
    if (params.title && params.title.trim().length > 0) {
        sections.push(`Title:\n${params.title.trim()}`);
    }
    if (params.abstract && params.abstract.trim().length > 0) {
        sections.push(`Abstract:\n${params.abstract.trim()}`);
    }
    sections.push(`Citation key map:\n${params.citation_legend}`);
    sections.push(`Canonical sections with citations:\n${params.canonical_with_citations}`);
    return `Use ONLY the following material.\n\n${sections.join('\n\n')}`;
}
