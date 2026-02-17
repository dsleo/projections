export const DISCOURSE_LABELS = [
    'Problem',
    'Landscape',
    'Contribution',
    'TechnicalCore',
    'Consequences',
] as const;

export type DiscourseLabel = (typeof DISCOURSE_LABELS)[number];

export type Sentence = {
    id: number;
    text: string;
    /** 0-based index in the global sentence list */
    position: number;
    /** 0-based start offset in preprocessed text */
    start?: number;
    /** 0-based end offset (exclusive) in preprocessed text */
    end?: number;
    /** 0-based start offset in original text */
    original_start?: number;
    /** 0-based end offset (exclusive) in original text */
    original_end?: number;
};

export type SentenceLabelMap = Record<string, DiscourseLabel[]>;

export type CanonicalSectionItem = {
    description: string;
    sentence_ids: number[];
};

export type ProblemAndMotivation = {
    central_problems: CanonicalSectionItem[];
    origins: CanonicalSectionItem[];
    nontriviality: CanonicalSectionItem[];
};

export type Landscape = {
    known_results: CanonicalSectionItem[];
    limitations: CanonicalSectionItem[];
    competing_approaches: CanonicalSectionItem[];
};

export type ContributionItem = {
    statement: string;
    sentence_ids: number[];
    prior_state: {
        text: string;
        sentence_ids: number[];
    };
    novelty: {
        text: string;
        sentence_ids: number[];
    };
    nontriviality: {
        text: string;
        sentence_ids: number[];
    };
};

export type Contributions = {
    contributions: ContributionItem[];
};

export type TechnicalCore = {
    key_ideas: CanonicalSectionItem[];
    technical_obstacles: CanonicalSectionItem[];
    reusable_constructions: CanonicalSectionItem[];
};

export type Consequences = {
    open_questions: CanonicalSectionItem[];
    speculative_extensions: CanonicalSectionItem[];
};

export type CanonicalSections = {
    problem_and_motivation: ProblemAndMotivation;
    landscape: Landscape;
    contributions: Contributions;
    technical_core: TechnicalCore;
    consequences: Consequences;
};

export type GroundedCitationItem = {
    text: string;
    sentence_ids: number[];
};

export type Pass3AudienceA = {
    problem_statement: GroundedCitationItem;
    delta_summary: GroundedCitationItem[];
    technical_highlights: {
        nonstandard_ideas: GroundedCitationItem[];
        clever_reductions: GroundedCitationItem[];
    };
    reusable_components: GroundedCitationItem[];
};

export type Pass3AudienceB = {
    problem_statement: GroundedCitationItem;
    why_matters: GroundedCitationItem[];
    prerequisite_map: string[];
    reading_path: {
        read: string[];
        skim: string[];
        skip: string[];
    };
};

export type Pass3AudienceC = {
    key_ideas: GroundedCitationItem[];
    problem_statement: GroundedCitationItem;
    reading_path: {
        read: string[];
        skim: string[];
        skip: string[];
    };
};

export type Pass3AudienceD = {
    problem_statement: GroundedCitationItem;
    one_page_summary: string;
    notes_to_self: string[];
};

export type Pass3Views = {
    domain_expert: Pass3AudienceA;
    adjacent_researcher: Pass3AudienceB;
    grad_student: Pass3AudienceC;
    author_self: Pass3AudienceD;
};

export type CitationEntry = {
    key: string;
    label?: string;
    text: string;
    labels: DiscourseLabel[];
    sentence_ids: number[];
};

export type CitationMap = Record<string, CitationEntry>;
export type SentenceCitationMap = Record<string, string[]>;

export type AnalysisResult = {
    document_title?: string;
    abstract?: string;
    filename?: string;
    original_latex: string;
    preprocessed_latex: string;
    sentences: Sentence[];
    labels: SentenceLabelMap;
    sentence_citations: SentenceCitationMap;
    citations: CitationMap;
    sections: CanonicalSections;
    sections_concatenated_text: string;
    audience_views?: Pass3Views;
};
