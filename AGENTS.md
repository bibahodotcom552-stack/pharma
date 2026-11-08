# Shared instructions for ALL AI tools (Claude Code, VS Code Copilot, Codex, Gemini CLI)

Read by Claude Code (through CLAUDE.md), GitHub Copilot (AGENTS.md / .github/copilot-instructions.md) and any other agent.
Project rules, file map and hard constraints live in CLAUDE.md. Do not duplicate them here.

## Ground rules for any agent
1. Zero-cost tools only. Never add a paid service without the user's explicit yes.
2. No patient data in code, logs, commits, issues, prompts or third-party services.
3. Before editing: read TASKS.md and HANDOFF.md "Now". Claim a task by writing your tool name next to it in TASKS.md.
4. After editing: run `python tests/mock_test.py` and `node tests/check_syntax.js`. Bump sw.js VERSION if app files changed.
5. Never push, merge, create repos or delete files without the user's explicit yes.
6. Leave a one-line note in TASKS.md when you finish: what changed, what is still open.
