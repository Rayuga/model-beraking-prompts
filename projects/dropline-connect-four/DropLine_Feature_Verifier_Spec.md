# DROPLINE

## Project, Feature and Verifier Specification

Local two-player play • deterministic game rules • reversible moves • durable match state

DropLine is a browser-based four-in-a-row game for two people sharing one
device. Its scope follows the new client's target-model and evaluation brief,
and it must behave like a complete game rather than a decorative board.

## Overview

DropLine uses the familiar seven-column by six-row Connect Four board. Red and
Yellow take turns dropping pieces. Each accepted piece falls to the lowest free
space in its column. The first player to connect four pieces horizontally,
vertically, or diagonally wins. Filling the board without a winning line ends
the round in a draw.

The implementation challenge is keeping every part of the game consistent.
The visible board, current player, move history, Undo/Redo stacks, terminal
result, scoreboard, next-round starter, and browser-stored state must always
describe the same match.

## How DropLine works

A normal round follows this flow:

```text
Red starts the first round
        ↓
A player selects a non-full column
        ↓
The piece falls to the lowest available row
        ↓
History records the accepted move
        ↓
The game checks win, draw, or next player
        ↓
The complete state is saved in the browser
```

After a win or draw, the board stops accepting moves. The result updates the
running scoreboard exactly once. The players may Undo the terminal piece and
continue, Redo it to restore the result, or begin the next round. Starting color
alternates between rounds.

## Players

### Red

Red uses the fixed Red identity and starts the first round. Red has no special
permission beyond being the initial player.

### Yellow

Yellow uses the fixed Yellow identity and plays after Red's first accepted
move. Yellow starts the second round, with the starting color continuing to
alternate on later rounds.

Both players use the same visible controls. There are no accounts, hidden
roles, computer opponent, or remote session in the current task.

## Core game rules

- The board is exactly seven columns wide and six rows high.
- Only one piece is placed for each accepted move.
- Pieces cannot float or leave gaps within a column.
- Full-column attempts are rejected visibly and do not consume a turn.
- Four same-color pieces in a horizontal, vertical, rising diagonal, or falling
  diagonal line win the round.
- Exactly the winning four cells are highlighted for the tested win sequences.
- No move is accepted after a win or draw.
- A full 42-cell board with no winning line is a draw.

## Match controls

### Move history

Each accepted move is listed with its move number, color, and one-based column.
Rejected moves never enter history.

### Undo and Redo

Undo removes exactly the latest piece, removes its history entry, and returns
the turn to that piece's player. Redo restores that same piece and advances the
turn again. Placing a different piece after Undo invalidates the redo branch.

If the removed move ended the round, Undo also removes the result and reverses
its scoreboard increment. Redo restores the result and increment once. Repeated
reloads or disabled control clicks must not duplicate scores.

### Next Round and Reset Match

Next Round is available after a result. It clears the current board and round
history, preserves the scoreboard, and alternates the starting color.

Reset Match clears the board, round history, Undo/Redo state, and all scoreboard
counters. Red becomes the starter again.

## Controls and interface

- Seven visible drop controls align with the seven board columns.
- The interface shows whose turn it is, terminal results, and invalid-move
  feedback.
- Left and Right move keyboard focus between columns without leaving the board.
- Home and End select the first and last columns.
- Enter and Space drop a piece into the selected column.
- Focus remains on the active column after an accepted move.
- Hover and keyboard focus preview the active color over a playable column.
- Accepted pieces use a short drop transition; winning pieces receive a clear
  result treatment.
- The board remains usable at a 375-pixel viewport without horizontal overflow.
- Accessible names communicate cell position and token identity so color is not
  the only state signal.
- Reduced-motion preferences suppress nonessential motion without changing
  game behavior.

## Persistence

The app stores a versioned `dropline:v1` value in localStorage after each
accepted mutation. It contains:

- 42 row-major board cells using `null`, `red`, or `yellow`;
- current player and round starter;
- playing, Red-won, Yellow-won, or draw status;
- exact winning cells;
- move history and redo entries with player, row, and column;
- Red-win, Yellow-win, and draw counters.

Reloading an unfinished or completed round restores the exact visible state.
Restoring a completed round does not record its score again. Malformed or
incompatible saved data opens as a clean match instead of breaking startup.

## Feature and sub-feature matrix

| Feature | Sub-feature | Required result |
|---|---|---|
| Bootstrap and board | Exact board | One empty 7×6 board with seven drop controls |
| Bootstrap and board | Initial state | Red turn, zero scores, empty history |
| Gameplay | Gravity | Piece occupies the lowest free cell |
| Gameplay | Stacking | Later pieces stack immediately above existing pieces |
| Gameplay | Turn order | Accepted moves alternate Red and Yellow |
| Gameplay | Invalid column | Full columns reject moves without side effects |
| Win detection | Horizontal | Four same-color pieces across one row win |
| Win detection | Vertical | Four same-color pieces in one column win |
| Win detection | Rising diagonal | Four same-color pieces rising left-to-right win |
| Win detection | Falling diagonal | Four same-color pieces falling left-to-right win |
| Round result | Highlight | Exact winning cells remain recognizable |
| Round result | Terminal lock | Board refuses further moves after the result |
| Round result | Draw | Full board without a winning line records one draw |
| History | Accepted moves | Exact move number, color, and column are shown |
| History | Rejected moves | Invalid attempts do not enter history |
| Undo/Redo | Single-piece Undo | Remove only the latest piece and restore its turn |
| Undo/Redo | Single-piece Redo | Restore the exact removed piece and turn transition |
| Undo/Redo | Branch invalidation | A new move after Undo clears Redo |
| Undo/Redo | Terminal reversal | Undo/Redo reverses and reapplies result score once |
| Match management | Next Round | Preserve scores and alternate starter |
| Match management | Reset Match | Clear board, histories and scores; restore Red starter |
| Persistence | In-progress reload | Restore exact board, turn, history and controls |
| Persistence | Completed reload | Restore result without duplicate score |
| Keyboard | Column movement | Left/Right/Home/End select correct visible column |
| Keyboard | Piece placement | Enter/Space follows the same rules as mouse input |
| Interface | Polish and responsive layout | Preview, motion and narrow-screen usability |

## Deterministic game scenarios

The following one-based column sequences are used by the golden solution and
browser rubric. They are not included in the agent-facing task instructions.

| Scenario | Column sequence | Expected result |
|---|---|---|
| Horizontal Red win | `1, 7, 2, 7, 3, 6, 4` | Red wins across bottom-row columns 1–4 |
| Vertical Red win | `1, 2, 1, 2, 1, 2, 1` | Red wins vertically in column 1 |
| Rising diagonal Red win | `1, 2, 2, 3, 4, 3, 3, 4, 5, 4, 4` | Red completes a rising diagonal |
| Falling diagonal Red win | `7, 6, 6, 5, 4, 5, 5, 4, 3, 4, 4` | Red completes a falling diagonal |
| Draw | `4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 5, 2, 5, 6, 5, 5, 5, 5, 2, 2, 2, 2, 2, 6, 1, 6, 6, 6, 6, 1, 1, 1, 1, 1, 7, 7, 7, 7, 7, 7` | Board fills with no winner and draw increments once |

## Golden-solution walkthrough

The later golden solution will run at `http://localhost:3000`.

### Workflow 1 — Play a normal opening

1. Confirm the board is empty and the status identifies Red.
2. Drop Red into column 4.
3. Drop Yellow into column 4.
4. Drop Red into column 2.

Expected result:

- Column 4 contains Red at the bottom and Yellow directly above it.
- Column 2 contains Red at the bottom.
- The status returns to Yellow.
- History contains exactly three accepted moves.

### Workflow 2 — Reject a full column

1. Reset the match.
2. Select column 1 six times.
3. Record the board, turn, history, and scores.
4. Select column 1 once more.

Expected result:

- The seventh attempt is visibly rejected.
- The board, current player, history, and scores remain unchanged.

### Workflow 3 — Win, Undo, and Redo

1. Reset the match.
2. Play the horizontal Red-win sequence.
3. Confirm Red's score becomes one and further board input is refused.
4. Undo once.
5. Redo once.

Expected result:

- Undo removes the final Red piece, reopens the round, and returns Red's score
  to zero.
- Redo restores the exact piece, result, winning highlight, and Red score once.

### Workflow 4 — Continue a match

1. From a completed round, choose Next Round.
2. Confirm the board and round history are empty while scores remain.
3. Confirm Yellow starts the new round.
4. Reload after several moves.

Expected result:

- The unfinished second round returns exactly after reload.
- Score, starter, turn, history, Undo, and Redo remain consistent.

### Workflow 5 — Reset everything

1. Complete at least one scored round.
2. Choose Reset Match.
3. Reload the page.

Expected result:

- The board and history are empty.
- Red, Yellow, and draw scores are zero.
- Red starts, and the reset state survives reload.

## Verifier matrix

| # | Verifier ID | Feature / sub-feature | Weight | Deterministic judgment |
|---:|---|---|---:|---|
| 1 | `bootstrap_exact_board_and_controls` | Bootstrap / exact surface | 0.5 | Require 42 cells, seven column controls, status, scores, history and match controls |
| 2 | `initial_red_turn_and_empty_state` | Bootstrap / initial state | 0.5 | Require empty board, Red turn and zero scores |
| 3 | `mouse_drop_obeys_gravity` | Gameplay / gravity | 0.5 | One real click places Red only in the bottom cell |
| 4 | `stacking_and_turn_alternation` | Gameplay / stacking and turns | 0.5 | Repeated column clicks stack with exact alternating colors |
| 5 | `full_column_rejection_invariant` | Gameplay / invalid full column | 1.0 | Seventh attempt is rejected with no board, turn, history or score change |
| 6 | `horizontal_four_win` | Win detection / horizontal | 1.0 | Exact horizontal sequence produces Red result |
| 7 | `vertical_four_win` | Win detection / vertical | 1.0 | Exact vertical sequence produces Red result |
| 8 | `rising_diagonal_four_win` | Win detection / rising diagonal | 1.0 | Exact rising sequence produces Red result |
| 9 | `falling_diagonal_four_win` | Win detection / falling diagonal | 1.0 | Exact falling sequence produces Red result |
| 10 | `winning_cells_exact_highlight` | Result / winning cells | 0.5 | Require exactly the four expected cells to have the winning treatment |
| 11 | `terminal_board_blocks_moves` | Result / terminal lock | 0.5 | Real clicks and keyboard input cannot add a post-result move |
| 12 | `full_board_draw_exact` | Result / draw | 1.5 | Exact 42-move sequence fills board, records draw once and highlights no winner |
| 13 | `move_history_exact_order` | History / accepted moves | 0.5 | Require exact move numbers, colors and one-based columns |
| 14 | `undo_one_piece_and_turn` | Undo/Redo / Undo | 0.5 | One Undo removes one piece and returns its player turn |
| 15 | `redo_one_piece_and_turn` | Undo/Redo / Redo | 0.5 | One Redo restores the same piece and next turn |
| 16 | `redo_invalidation_after_new_move` | Undo/Redo / branching | 1.0 | New move after Undo makes old Redo unavailable and harmless |
| 17 | `undo_result_reopens_and_reverses_score` | Undo/Redo / terminal reversal | 1.5 | Undo winning move reopens board and subtracts score exactly once |
| 18 | `redo_result_reapplies_once` | Undo/Redo / terminal Redo | 0.5 | Redo restores result and score without double counting |
| 19 | `next_round_preserves_score_and_alternates_starter` | Match / next round | 1.0 | Clear board/history, retain score and make Yellow the next starter |
| 20 | `reset_match_clears_everything` | Match / reset | 0.5 | Clear state and scores, return Red starter, and persist reset |
| 21 | `in_progress_reload_exact_state` | Persistence / unfinished round | 1.5 | Reload preserves exact visible state and functional Undo/Redo |
| 22 | `completed_reload_does_not_double_count` | Persistence / terminal round | 0.5 | Repeated reloads retain one result increment |
| 23 | `keyboard_left_right_and_drop` | Keyboard / navigation and placement | 0.5 | Real arrows and Enter/Space select and play expected columns |
| 24 | `keyboard_home_end_boundaries_and_focus` | Keyboard / boundaries | 0.5 | Home/End and boundary arrows keep board focus in columns 1–7 |
| 25 | `hover_preview_and_drop_motion` | Interface / interaction polish | 0.5 | Visible preview matches active color and accepted token has finite drop motion |
| 26 | `responsive_board_no_overflow` | Interface / responsive layout | 0.5 | At 375px, all columns and primary controls remain visible and usable |

The browser total is 19.5 points. A separate 0.5-point preflight validates the
manifest, start command, application health, and restart behavior, producing 27
scored checks and exactly 20 points.

## Verifier execution rules

- Use real Playwright mouse and keyboard actions against the visible app.
- Do not dispatch synthetic events, mutate the DOM, invoke internal handlers,
  or use hidden routes to create game state.
- Build each criterion's state through visible Reset Match and visible moves.
- Read rendered state for judgment. Browser storage may be inspected only where
  needed to confirm persistence shape; it must not be written to stage a test.
- Keep criteria all-or-nothing and ensure failed or rejected actions have no
  hidden side effect.
- Run criteria individually with one judge and one LLM call at a time.

## Implementation and judge configuration

- Node 22 and Express serve a static HTML/CSS/JavaScript application.
- Pure game functions remain separate from rendering and persistence.
- `APP_MANIFEST.md` records the start command and application surface.
- RewardKit uses its native `codex` judge adapter with
  `openai/gpt-5.6-luna` and headless Playwright MCP.
- Codex uses an OpenRouter custom model provider configured through its base
  URL, API-key environment variable, and Responses protocol.
- GPT-5.4-mini is the only initial target model. Sonnet 4.5 and Haiku 4.5 are
  deferred.

## Validation order

1. Validate task structure, TOML, Python, JavaScript, manifest, and weights.
2. Run pure rule tests and validate every recorded move sequence.
3. Run application startup and restart checks.
4. Smoke-test one Luna/Playwright criterion.
5. Run the complete golden solution twice.
6. Run instruction-to-verifier traceability and QC.
7. Build a clean upload ZIP excluding planning files, context, Git files,
   caches, and jobs.
8. Run GPT-5.4-mini only after the golden and verifier checks pass.

## Key controls

- Board, history, turn, result, score, and persisted data must never disagree.
- Invalid moves must be side-effect free.
- Terminal results count exactly once.
- Undo/Redo must remain single-piece and score-aware.
- Round changes preserve only the state they are intended to preserve.
- Reload must restore rather than replay accepted mutations.
- Every graded requirement must be present in the human-facing instruction set.
- Every browser probe must be repeatable without hidden setup behavior.

## Future-work boundary

Computer opponents, online play, editable names, best-of-three matches,
tournaments, themes, sound, advanced animation, replay sharing, archives,
statistics, and touch gestures are not part of the current task or scoring
contract. They remain in `CONTEXT.md` until instruction, golden implementation,
and deterministic verifier coverage are added together.

## Why DropLine matters

A shallow solution can draw a blue board and alternate colored circles. A
complete DropLine implementation must preserve the meaning of every move across
gravity, turn order, invalid actions, four win directions, terminal locking,
history, Undo/Redo, scoreboard changes, round transitions, keyboard use, and
reloads.

The task is intentionally approachable for smaller models, but its exact state
transitions still distinguish a working game from a visual mock-up.
