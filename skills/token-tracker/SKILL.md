---
name: token-tracker
description: Inspect token consumption (input, output, cache read) per task and conversation in Antigravity, or surface the Token Tracker side panel.
---

# Token Tracker

Antigravity records per-step token counts (`input_tokens`, `output_tokens`, `cache_read_tokens`) in each conversation's `transcript.jsonl` under `~/.gemini/antigravity/brain/<conversationId>/.system_generated/logs/transcript.jsonl`.

## Opening the UI Panel

When the user wants to view token usage visually in the side pane, surface the sidecar pill:

`[Token Tracker](sidecar://token-tracker/token_panel/)`

## Querying Token Usage in Chat

If the user asks for token stats directly in chat, you can summarize `transcript.jsonl` for the current conversation (`<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`) or across `~/.gemini/antigravity/brain/*/.system_generated/logs/transcript.jsonl` using `jq` or `node`.
