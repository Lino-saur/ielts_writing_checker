# Teaching rules roadmap

## Non-negotiable review behavior

- Grammar corrections must cite one or more rules selected from the published backend rule set for that review.
- Article optimization is rule-driven, not unrestricted rewriting. Every optimization edit must cite one or more selected backend rules.
- If no selected rule supports an edit, the original text must be preserved.
- Stored review results must retain the exact rule id, version, source, and knowledge-point code used at review time.

## P0

1. Prefer structured practice metadata for Task 1 visual type; classify uploaded visuals before rule retrieval when metadata is unavailable.
2. Validate model citations against the exact selected rule snapshot and reject unsupported edits.
3. Introduce rule-set releases, regression evaluation, staged rollout, and rollback.

## P1

1. Reuse one retrieval snapshot across scoring and revision where their scopes overlap; cache published rule metadata briefly.
2. Include positive and negative examples only for the most relevant rules.
3. Replace free-text question types and retrieval tags with controlled values and autocomplete.
4. Track selected, cited, accepted, ignored, and user-rated rule usage.
5. Prevent publishing an unchanged published rule as a new version.

## P2

1. Add a user-facing rule detail panel with principle, source page, and examples.
2. Add admin version comparison, rollback, duplicate detection, and conflict review.
3. Split long rules into principle, applicability, exception, and example fields.
