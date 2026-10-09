# Kittle matter chat v2, 9 October 2026

- Archive: kittle-matter-chat.zip
- SHA256: 0c0170a4be9ffdee9ed380dded4a8a69250498fc63385b6bbf3b7eb251e8f861
- Source commit: 9766459f on task/kittle-matter-chat-hard. 32 files, LF, byte-identical to the committed task. Category: Messaging & Chat Interfaces.

## Change from v1 (0536e37e)

The only change is the last line of instruction.md. It now asks the builder to try the app in a browser, from the pages themselves, and says that something working only through direct server calls does not count. Grading, gates, criteria, the golden and the seed are unchanged.

## Why

The v1 runs scored:

| Run | Reward |
|---|---|
| Oracle | 1.0 (gates 1, functional 1, polish 1, visual 1) |
| nop | 0 |
| Luna | 0 |

Luna's app was a real failure:
- Its fetch helper spread `options` after the merged headers, so sending a message dropped `Content-Type: application/json`.
- Every post was then rejected as empty, and the constraints gate failed.
- Luna had tested only with direct server calls (an 11-minute run, $0.08).

## Checks

- The public checks pass.
- The golden and every grading file are unchanged, so the v1 scripted golden (19/19) and the Oracle 1.0 on identical grading still apply. That is not a new measurement.
