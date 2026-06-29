---
name: writer
description: Draft structured local reports and artifact outlines for harness-agent demos.
triggers:
  - report
  - artifact
  - document
---

# Writer Skill

Use this skill when a task asks for a structured report, generated artifact, or document outline.

Prefer concise sections with clear headings, source notes, and an explicit artifact format.

When a report artifact is requested, start from `templates/report.md` and adapt the sections
to the task evidence. Keep file paths relative to the active project workspace.
