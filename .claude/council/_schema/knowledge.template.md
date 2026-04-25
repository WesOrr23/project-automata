---
agent: <slug>
type: knowledge
topic: <topic-slug>
schema-version: 1
verified-as-of: <commit-hash>
last-updated: YYYY-MM-DD
confidence: <high|medium|low>
---

# <Topic Title>

## Principle

<What is true. The core fact or rule. Plain language.>

## Current state

<What this looks like in the actual codebase as of `verified-as-of`. Cite files but prefer concepts over line numbers (which rot).>

## What to look for in diffs

<Patterns or signals that indicate this principle is being violated or affirmed.>

## What's fine

<Patterns that look like violations but aren't. Helps reduce false positives.>

## Provenance

<Where this knowledge came from: the design doc, a prior decision, an audit finding, etc.>
