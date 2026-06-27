---
description: The meeting-ingest skill skeleton — the generalized form of MOT's video-process. Turns raw transcripts + frames into a speaker-ID'd, QA'd meeting summary, then feeds entity overviews and the roll-up. Sub-skill of the periodic-sync orchestrator. Parameterized by the transcription adapter and the people registry; every company value is a {company-slot} naming its manifest field. The web-clip cutter is out of the core.
references:
  - path: templates/skills/periodic-sync.template.md
    type: trigger
    note: The orchestrator's Step 5 hands off to this sub-skill when the transcription adapter yields new recordings.
  - path: tooling/config.schema.json
    type: standard
    note: The transcription backend, media tool, recordings + summary locations, and the speaker-ID people seed all come from this manifest schema (input_adapters.transcription, entity_registry.people).
status: current
context: framework-architecture
tags: [framework-meta]
node_kind: topic
---

# Meeting-Ingest — template

> **Mechanism only.** Every `{slot}` names a `manifest.json` field. The transcription backend, media tool,
> and folder locations come from `{transcription-adapter}` (manifest `input_adapters.transcription`);
> speaker-ID candidates come from `{people-registry}`. This generalizes MOT's `video-process`.

## Preamble

You already have `{hub-file}` and `{state-file}` in context. Do **not** preload the recording tracker, the
style Standard, or the QA checklist — read them in the step that needs them. Use `{state-file}` for
last-processed status (the recording tracker is typically `{avoid-read-marker}`).

Scope trigger *(instance-named)*: the meeting verbs for this instance — e.g. "process recording", "meeting
summary". Also triggered from the periodic-sync orchestrator (Step 5).

**Prerequisite:** raw transcripts + frames must already exist — produced by `{transcription-adapter.backend}`
(manifest `input_adapters.transcription.backend`). The framework bundles transcription as a real
prerequisite skill rather than leaving it an undocumented external seam.

## Locations (all from the manifest)

- **Raw recordings:** `{transcription-adapter.recordings_location}`.
- **Per-recording working folder:** a timestamp-named subfolder under the recordings location (audio, raw
  transcript, intermediates stay here for traceability).
- **Finished summaries + selected frames:** `{transcription-adapter.summary_location}`.

## Steps for each recording

1. Create the per-recording working folder; extract audio with `{transcription-adapter.media_tool}`.
2. Obtain the transcript from `{transcription-adapter.backend}`. Read `{style-standard}` now, before
   drafting the summary.
3. Extract key frames; copy only the instructive ones (see Frame guidance) into the summary location with
   descriptive names.
4. Write the meeting summary in the summary location with date, duration, participants, topics +
   timestamps, decisions, action items, technical details, and embedded frames. **Read `{qa-checklist}`
   now** and apply every item (cross-referencing, speaker-ID correction, technical-claim verification,
   missing-frame request, strategic enrichment, cross-reference marker).

   **Frontmatter (required).** Begin the summary with `{required-fields}` frontmatter:

   ```yaml
   ---
   description: "<one-line gloss: date + partner + topic, terse and specific — not 'meeting summary'>"
   references:
     - path: {entity-overview-path}      # per project discussed; type from {edge-vocab}
       type: references
     # zero entries is OK for a purely-internal team meeting
   ---
   ```

   Resolve `{entity-overview-path}` against the project index — never hand-author a non-existent path. Omit
   the array if no project applies; do not invent one.
5. Update the relevant entity `Overview`(s) with decisions, technical details, and action items (feeds
   periodic-sync Steps 3–4).
6. Add a row to the recording tracker and run `{state-tool}` (write-state mode) so `{state-file}` reflects
   the new recording.

## Frame / image guidance

Include frames that carry information: readable slides, technical drawings/schematics/CAD, equipment
photos, participant grids (for speaker ID), whiteboard notes, on-screen data/measurements, calendar views
giving context. Skip idle/black screens, content-free talking heads, near-duplicate slide frames, blurry
content, generic call-UI without participant info. Name `<date>_<description>.<ext>`; embed near the topic
it illustrates.

## Speaker labeling

Use every available context cue: face recognition from frames (against the team's known photos +
signature blocks + on-call name labels); voice/language priors; calendar/invite metadata for expected
participants; on-screen name labels; conversation content ("my design" → who owns it, from
`{people-registry}`). Label speakers `[Speaker: Name]`; use `[Speaker: Unknown-N]` when uncertain and note
partial clues. **Do not auto-map a transcribed nickname onto a similarly-named person** without a
corroborating cue — keep distinct people distinct (an instance-specific confusion the registry encodes).

## Processing order

Process recent → old (backward catch-up). During catch-up, do **not** assume "no new recording after the
last processed date" means everything is current — older recordings may still hold unprocessed project
information. Once the backlog is clear, the usual forward assumption applies.

## Notes

- Recordings may run idle at the end (recorder left on) — note this in the summary.
- Recordings vary (meeting / screen-share / lab / demo) — adapt frame extraction accordingly.
- Raw working files stay in their subfolders for traceability; only the summary + selected frames go to the
  summary location.

> **Out of the core:** the **web-clip cutter** (cut web-efficient looping clips from source video for the
> website) is a company-product utility, **not** part of this knowledge-OS workflow — it stays instance-local
> and is not generalized into the framework.
