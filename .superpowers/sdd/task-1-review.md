# Task 1 Review

## Verdict

- Spec compliance: ❌
- Code quality: Changes requested

## Important findings

1. `parseDerivedManifest` accepts non-canonical JSON. It must reject payloads whose object keys are not lexicographically ordered or that contain non-canonical extra whitespace. Add regression tests for reversed keys and whitespace.
2. `parseRequirementBlocks` silently accepts malformed or unclosed `<!-- requirement` markers as an empty document. Detect every start token and reject any marker that does not match the complete grammar. Add malformed same-line and unclosed-marker regression tests.

## Prettier concern

The explicit shared-config formatting/check is acceptable for Task 1. Record the root workspace-config resolution as a later repository-tooling issue; it does not block Task 1.
