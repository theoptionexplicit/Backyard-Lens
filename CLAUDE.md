# CLAUDE.md

## Project Overview

Backyard-Lens is a collaborative poetry repository containing a single literary work, "Backyard Loupe" by Michael Colombo. This is not a software project — it has no code, build system, or dependencies.

## Repository Structure

```
Backyard-Lens/
├── README.md        # Project title and tagline ("Radiant Poetry")
├── BackyardLens     # The poem (plain text, no file extension)
└── CLAUDE.md        # This file
```

## Content

The sole content file `BackyardLens` is a three-stanza poem with nautical and winter imagery. The author is credited at the bottom of the file.

## Development Workflow

- The repository uses a simple branching model with pull requests for collaborative editing.
- Changes have historically been made via GitHub's web editor (patch branches like `theoptionexplicit-patch-1`).
- The default branch is `master`.

## Conventions

- The poem file (`BackyardLens`) has no file extension.
- Stanzas are separated by double blank lines.
- Lines within a stanza are separated by single blank lines.
- Author attribution appears on the last line, prefixed with `- `.

## Contributors

- **pushtheotherbutton** — initial creation, formatting, and major edits
- **theoptionexplicit** — title change and word-level revisions

## Notes for AI Assistants

- Treat the poem text as creative/literary content; do not reformat, rewrite, or "correct" it without explicit instruction.
- There are no tests, linters, build steps, or CI pipelines to run.
- Any new files should follow the existing convention of plain text without extensions unless otherwise directed.
