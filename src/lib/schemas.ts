import { z } from 'zod';

import { DISCOURSE_LABELS } from './pipeline/types';

export const DiscourseLabelSchema = z.enum(DISCOURSE_LABELS);

/** Pass 1 output schema: { "101": ["Problem", ...], ... } (only sentences with >= 1 label) */
export const SentenceLabelMapSchema = z.record(z.array(DiscourseLabelSchema));

export const SentenceSchema = z.object({
    id: z.number().int().nonnegative(),
    text: z.string(),
    position: z.number().int().nonnegative(),
});

export const CanonicalSectionItemSchema = z.object({
    description: z.string(),
    sentence_ids: z.array(z.number().int().nonnegative()),
});

export const GroundedTextSchema = z.object({
    text: z.string(),
    sentence_ids: z.array(z.number().int().nonnegative()),
});

export const ProblemAndMotivationSchema = z.object({
    central_problems: z.array(CanonicalSectionItemSchema),
    origins: z.array(CanonicalSectionItemSchema),
    nontriviality: z.array(CanonicalSectionItemSchema),
});

export const LandscapeSchema = z.object({
    known_results: z.array(CanonicalSectionItemSchema),
    limitations: z.array(CanonicalSectionItemSchema),
    competing_approaches: z.array(CanonicalSectionItemSchema),
});

export const ContributionItemSchema = z.object({
    statement: z.string(),
    sentence_ids: z.array(z.number().int().nonnegative()),
    prior_state: GroundedTextSchema,
    novelty: GroundedTextSchema,
    nontriviality: GroundedTextSchema,
});

export const ContributionsSchema = z.object({
    contributions: z.array(ContributionItemSchema),
});

export const TechnicalCoreSchema = z.object({
    key_ideas: z.array(CanonicalSectionItemSchema),
    technical_obstacles: z.array(CanonicalSectionItemSchema),
    reusable_constructions: z.array(CanonicalSectionItemSchema),
});

export const ConsequencesSchema = z.object({
    open_questions: z.array(CanonicalSectionItemSchema),
    speculative_extensions: z.array(CanonicalSectionItemSchema),
});

export const CanonicalSectionsSchema = z.object({
    problem_and_motivation: ProblemAndMotivationSchema,
    landscape: LandscapeSchema,
    contributions: ContributionsSchema,
    technical_core: TechnicalCoreSchema,
    consequences: ConsequencesSchema,
});

export const GroundedCitationItemSchema = z.object({
    text: z.string(),
    citation_keys: z.array(z.string()),
});

export const Pass3AudienceASchema = z.object({
    delta_summary: z.array(GroundedCitationItemSchema),
    new_vs_prior: z.array(GroundedCitationItemSchema),
    technical_highlights: z.object({
        nonstandard_ideas: z.array(GroundedCitationItemSchema),
        clever_reductions: z.array(GroundedCitationItemSchema),
    }),
    reusable_components: z.array(GroundedCitationItemSchema),
    suppress: z.array(z.string()),
});

export const Pass3AudienceBSchema = z.object({
    problem_statement: GroundedCitationItemSchema,
    why_matters: z.array(GroundedCitationItemSchema),
    prerequisite_map: z.array(z.string()),
    reading_path: z.object({
        read: z.array(z.string()),
        skim: z.array(z.string()),
        skip: z.array(z.string()),
    }),
});

export const Pass3AudienceCSchema = z.object({
    conceptual_map: z.array(z.string()),
    key_ideas: z.array(GroundedCitationItemSchema),
    suggested_first_pass: z.array(z.string()),
    ignore_initially: z.array(z.string()),
    permission_to_skip: z.string(),
});

export const Pass3AudienceDSchema = z.object({
    one_page_summary: z.string(),
    dependency_graph: z.array(z.string()),
    fragile_arguments: z.array(GroundedCitationItemSchema),
    robust_arguments: z.array(GroundedCitationItemSchema),
    notes_to_self: z.array(z.string()),
});
