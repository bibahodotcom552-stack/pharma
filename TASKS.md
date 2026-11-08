# TASKS — shared queue for Claude Code and VS Code Copilot

How it works:
- Add a task under "Queue" with a clear one-line goal and a "Done when" check.
- To hand a task to a tool, write `→ claude` or `→ copilot` after it.
- When you take it, change the marker to `[in progress: <tool>]`.
- When done, move it to "Done" with the date and a one-line result.

## Queue
- [ ] Verify mock test still passes after setup → claude
      Done when: `python tests/mock_test.py` prints PASS.
- [ ] Review index.html and js/ for privacy leaks (names, P/NO never stored) → copilot
      Done when: a list of findings, or "none found", is added to Done.

## Done
