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
    prior_state: string;
    novelty: string;
    nontriviality: string;
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

export type AnalysisResult = {
    document_title?: string;
    filename?: string;
    original_latex: string;
    preprocessed_latex: string;
    sentences: Sentence[];
    labels: SentenceLabelMap;
    sections: CanonicalSections;
    sections_concatenated_text: string;
};
