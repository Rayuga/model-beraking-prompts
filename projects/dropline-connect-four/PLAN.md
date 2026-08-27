# DropLine - Four in a Row

## Summary

DropLine will be a medium-difficulty Harbor WebDev task aimed initially at
GPT-5.4-mini. It will use the same task structure, split instructions, golden
solution, deterministic browser rubric, and QC process used by the existing
projects, while keeping the product smaller and easier than GridForge and
PatchPad.

The game is local Red-versus-Yellow Connect Four on a standard seven-column by
six-row board. Red starts the first round. The players alternate accepted moves,
and a piece falls into the lowest free space in its selected column. Four pieces
connected horizontally, vertically, or diagonally win. A full board without a
winner is a draw.

## Product behavior

- Render the board as an accessible vanilla DOM grid served by Node 22 and
  Express. Do not use Canvas, React, a game framework, or runtime CDN imports.
- Provide visible column controls, current-turn and result feedback, a running
  Red/Yellow/draw scoreboard, move history, Undo, Redo, Next Round, and Reset
  Match.
- Reject moves into full columns without changing the board, history, or turn.
- Highlight exactly the winning four cells and refuse further moves after a win
  or draw.
- Undo removes one piece and returns the turn to the player whose piece was
  removed. Redo restores that piece. A different move after Undo clears Redo.
- Undoing a terminal move reopens the round and reverses its recorded score.
  Redo restores the result and score exactly once.
- Next Round preserves the scoreboard, clears the round, and alternates the
  starting color. Reset Match clears the board, history, redo state, and scores,
  then restores Red as the starter.
- Persist the complete match in browser storage after every accepted mutation.
  Reloading must restore the board, turn, status, winning cells, history, redo
  state, round starter, and scores without counting a completed result twice.
- Support mouse play and keyboard play. Left and Right move between columns,
  Home and End select the first and last columns, and Enter or Space drops a
  piece. Focus stays with the selected column.
- Use a responsive interface with hover/focus previews, a short drop transition,
  a clear winning treatment, and reduced-motion support. Color must not be the
  only way token state is communicated.

## Persistent state

Use a versioned `dropline:v1` localStorage value containing:

- 42 row-major cells represented by `null`, `red`, or `yellow`;
- the current player, round starter, round status, and exact winning cells;
- current-round history and redo entries with player, row, and column;
- Red-win, Yellow-win, and draw counters.

Malformed or incompatible saved data should fall back to a clean match without
preventing the app from opening.

## Task instructions

Keep the main `instruction.md` short and human-written. It will direct the agent
to read every topic file under `environment/instructions/`:

- `overview.md` - product, stack, and local two-player scope;
- `gameplay.md` - board, gravity, turns, wins, draw, and terminal behavior;
- `history-and-match.md` - move history, one-piece Undo/Redo, scoring, rounds,
  and reset;
- `controls.md` - mouse and keyboard operation;
- `persistence.md` - reload continuity and saved-state handling;
- `interface.md` - visible feedback, responsive layout, and restrained polish.

Instructions will describe normal user behavior without exposing the verifier's
exact move sequences. Every graded expectation must trace to an instruction.

## Golden implementation

The later Harbor task will live at
`projects/dropline-connect-four/dropline-connect-four/` and include:

- the split instruction files and Docker environment;
- a locked Node/Express golden solution and `APP_MANIFEST.md`;
- pure game functions separated from DOM rendering and storage;
- `solve.sh`, `task.toml`, test harness, browser rubric, and judge prompt.

Pure tests will cover piece placement, gravity, all win directions, draw
detection, Undo/Redo, score reversal, round changes, and state validation before
the same scenarios are used by browser verifiers.

## Verifier design

Use 26 browser criteria worth 19.5 points and one 0.5-point startup/manifest
preflight, for 27 scored checks and exactly 20 points. Browser checks use real
mouse and keyboard input. They must not dispatch synthetic events, mutate the
DOM, call application handlers, or use hidden setup routes.

| # | Criterion | Weight |
|---:|---|---:|
| 1 | `bootstrap_exact_board_and_controls` | 0.5 |
| 2 | `initial_red_turn_and_empty_state` | 0.5 |
| 3 | `mouse_drop_obeys_gravity` | 0.5 |
| 4 | `stacking_and_turn_alternation` | 0.5 |
| 5 | `full_column_rejection_invariant` | 1.0 |
| 6 | `horizontal_four_win` | 1.0 |
| 7 | `vertical_four_win` | 1.0 |
| 8 | `rising_diagonal_four_win` | 1.0 |
| 9 | `falling_diagonal_four_win` | 1.0 |
| 10 | `winning_cells_exact_highlight` | 0.5 |
| 11 | `terminal_board_blocks_moves` | 0.5 |
| 12 | `full_board_draw_exact` | 1.5 |
| 13 | `move_history_exact_order` | 0.5 |
| 14 | `undo_one_piece_and_turn` | 0.5 |
| 15 | `redo_one_piece_and_turn` | 0.5 |
| 16 | `redo_invalidation_after_new_move` | 1.0 |
| 17 | `undo_result_reopens_and_reverses_score` | 1.5 |
| 18 | `redo_result_reapplies_once` | 0.5 |
| 19 | `next_round_preserves_score_and_alternates_starter` | 1.0 |
| 20 | `reset_match_clears_everything` | 0.5 |
| 21 | `in_progress_reload_exact_state` | 1.5 |
| 22 | `completed_reload_does_not_double_count` | 0.5 |
| 23 | `keyboard_left_right_and_drop` | 0.5 |
| 24 | `keyboard_home_end_boundaries_and_focus` | 0.5 |
| 25 | `hover_preview_and_drop_motion` | 0.5 |
| 26 | `responsive_board_no_overflow` | 0.5 |

Each criterion will establish its own state using visible Reset Match or a
clearly retained state from that criterion. The exact deterministic sequences
are:

- Horizontal Red win: `1, 7, 2, 7, 3, 6, 4`
- Vertical Red win: `1, 2, 1, 2, 1, 2, 1`
- Rising diagonal Red win: `1, 2, 2, 3, 4, 3, 3, 4, 5, 4, 4`
- Falling diagonal Red win: `7, 6, 6, 5, 4, 5, 5, 4, 3, 4, 4`
- Draw: `4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 5, 2, 5, 6, 5, 5,
  5, 5, 2, 2, 2, 2, 2, 6, 1, 6, 6, 6, 6, 1, 1, 1, 1, 1, 7, 7, 7, 7,
  7, 7`

## Judge and validation

- Use RewardKit's native `codex` judge adapter with model
  `openai/gpt-5.6-luna` and headless Playwright MCP.
- Configure a Codex `openrouter` provider through `base_url`, `env_key`, and the
  Responses wire protocol. Do not silently fall back to Sonnet.
- Keep one judge and one LLM call active at a time.
- Run GPT-5.4-mini as the initial target model. Sonnet 4.5 and Haiku 4.5 remain
  deferred.

Validation order:

1. Parse TOML, Python, and JavaScript and verify criterion weights.
2. Run pure game-engine tests and validate every recorded move sequence.
3. Run manifest/startup and restart preflight checks.
4. Smoke-test one Luna/Playwright criterion.
5. Run the complete golden solution twice to confirm deterministic passes.
6. Run instruction-to-verifier traceability and task QC.
7. Build a clean upload ZIP without Git files, caches, jobs, planning files, or
   `CONTEXT.md`.
8. Run GPT-5.4-mini only after the golden and verifier checks pass.

## Later specification document

Create these beside this plan on the other development PC:

- `DropLine_Feature_Verifier_Spec.md`
- `DropLine_Feature_Verifier_Spec.docx`

The document will follow the Docketlight presentation style: product overview,
rules, normal workflows, feature/sub-feature matrix, golden walkthrough,
verifier matrix, scoring, key controls, and the future-work boundary.
