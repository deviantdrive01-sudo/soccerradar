@AGENTS.md

# Credit/cost discipline

Follow these unless the user explicitly asks for the more expensive option:

- Don't spawn an Explore/Plan/general-purpose subagent for anything answerable with 1-3 direct `Read`/`Grep`/`Bash` calls. Reserve subagents for genuinely broad, multi-area research.
- Never dump large raw API responses, DB rows, or file contents into the conversation to "let the user see it." Save to a scratch file (`/tmp/...`) and summarize the shape/content in a few lines instead. Only paste the exact small slice being discussed.
- Don't re-run `npm run build` / `tsc --noEmit` / lint after every single file edit. Batch related edits, then verify once.
- Don't re-fetch or re-read data already established earlier in the same session just to "double check" — trust prior results unless something concrete suggests they're stale.
- Before doing live testing against external APIs or the production pipeline, default to the smallest possible scope (one fixture/league/row), not a full run, unless the user asks for full scope.
- When a request is exploratory ("what do you think", "how should we approach this"), answer in 2-3 sentences with a recommendation — don't launch research or subagents to produce a fuller survey unless asked.
