import assert from "node:assert/strict";
import test from "node:test";

import {
  COLUMNS,
  ROWS,
  cellIndex,
  createInitialState,
  dropPiece,
  normalizeState,
  redoMove,
  resetMatch,
  startNextRound,
  tokenAt,
  undoMove,
} from "../public/js/game.js";

const sequences = {
  horizontal: [1, 7, 2, 7, 3, 6, 4],
  vertical: [1, 2, 1, 2, 1, 2, 1],
  rising: [1, 2, 2, 3, 4, 3, 3, 4, 5, 4, 4],
  falling: [7, 6, 6, 5, 4, 5, 5, 4, 3, 4, 4],
  yellowHorizontal: [7, 1, 7, 2, 6, 3, 6, 4],
  draw: [4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 5, 2, 5, 6, 5, 5, 5, 5, 2, 2, 2, 2, 2, 6, 1, 6, 6, 6, 6, 1, 1, 1, 1, 1, 7, 7, 7, 7, 7, 7],
};

function play(sequence, initial = createInitialState()) {
  let state = initial;
  for (const oneBasedColumn of sequence) {
    const result = dropPiece(state, oneBasedColumn - 1);
    assert.equal(result.accepted, true, `move in column ${oneBasedColumn} should be accepted`);
    state = result.state;
  }
  return state;
}

test("initial state is a clean 7 by 6 Red round", () => {
  const state = createInitialState();
  assert.equal(state.board.length, ROWS * COLUMNS);
  assert.ok(state.board.every((cell) => cell === null));
  assert.equal(state.currentPlayer, "red");
  assert.deepEqual(state.scores, { red: 0, yellow: 0, draws: 0 });
});

test("gravity stacks alternating pieces from the bottom", () => {
  const state = play([4, 4, 4]);
  assert.equal(tokenAt(state, 5, 3), "red");
  assert.equal(tokenAt(state, 4, 3), "yellow");
  assert.equal(tokenAt(state, 3, 3), "red");
  assert.equal(state.currentPlayer, "yellow");
});

test("a seventh move in a full column has no side effects", () => {
  const full = play([1, 1, 1, 1, 1, 1]);
  const before = JSON.stringify(full);
  const rejected = dropPiece(full, 0);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "column-full");
  assert.equal(JSON.stringify(rejected.state), before);
});

for (const direction of ["horizontal", "vertical", "rising", "falling"]) {
  test(`${direction} sequence records one Red win and four winning cells`, () => {
    const state = play(sequences[direction]);
    assert.equal(state.status, "red-won");
    assert.equal(state.scores.red, 1);
    assert.equal(state.winningCells.length, 4);
    assert.equal(new Set(state.winningCells).size, 4);
  });
}

test("Yellow can win and receives the exact horizontal winning line", () => {
  const state = play(sequences.yellowHorizontal);
  assert.equal(state.status, "yellow-won");
  assert.deepEqual(state.scores, { red: 0, yellow: 1, draws: 0 });
  assert.deepEqual(state.winningCells, [35, 36, 37, 38]);
});

test("terminal state blocks later moves", () => {
  const won = play(sequences.horizontal);
  const before = JSON.stringify(won);
  const result = dropPiece(won, 4);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "round-complete");
  assert.equal(JSON.stringify(result.state), before);
});

test("the supplied 42-move sequence is an exact draw", () => {
  const state = play(sequences.draw);
  assert.equal(state.board.filter(Boolean).length, 42);
  assert.equal(state.status, "draw");
  assert.equal(state.scores.draws, 1);
  assert.deepEqual(state.winningCells, []);
});

test("Undo and Redo each move exactly one piece and preserve turns", () => {
  const threeMoves = play([4, 4, 2]);
  const undone = undoMove(threeMoves);
  assert.equal(undone.accepted, true);
  assert.equal(undone.state.board.filter(Boolean).length, 2);
  assert.equal(undone.state.currentPlayer, "red");
  assert.equal(undone.state.history.length, 2);
  assert.equal(undone.state.redo.length, 1);

  const redone = redoMove(undone.state);
  assert.equal(redone.accepted, true);
  assert.equal(redone.state.board.filter(Boolean).length, 3);
  assert.equal(redone.state.currentPlayer, "yellow");
  assert.deepEqual(redone.state.history, threeMoves.history);
});

test("a different move after Undo invalidates Redo", () => {
  const state = play([4, 4, 2]);
  const undone = undoMove(state).state;
  const branch = dropPiece(undone, 5).state;
  assert.equal(branch.redo.length, 0);
  assert.equal(redoMove(branch).accepted, false);
});

test("terminal Undo and Redo reverse and reapply score once", () => {
  const won = play(sequences.horizontal);
  const undone = undoMove(won).state;
  assert.equal(undone.status, "playing");
  assert.equal(undone.scores.red, 0);
  assert.equal(undone.currentPlayer, "red");
  assert.deepEqual(undone.winningCells, []);

  const redone = redoMove(undone).state;
  assert.equal(redone.status, "red-won");
  assert.equal(redone.scores.red, 1);
  assert.equal(redoMove(redone).accepted, false);
  assert.equal(redone.scores.red, 1);
});

test("Next Round preserves score and alternates starter", () => {
  const won = play(sequences.horizontal);
  const next = startNextRound(won).state;
  assert.equal(next.roundStarter, "yellow");
  assert.equal(next.currentPlayer, "yellow");
  assert.equal(next.status, "playing");
  assert.equal(next.scores.red, 1);
  assert.ok(next.board.every((cell) => cell === null));
  assert.deepEqual(next.history, []);
});

test("Reset Match clears the entire match", () => {
  const secondRound = startNextRound(play(sequences.horizontal)).state;
  const dirty = play([4, 5], secondRound);
  const reset = resetMatch().state;
  assert.deepEqual(reset, createInitialState());
  assert.notDeepEqual(dirty, reset);
});

test("serialized terminal and redo states normalize without replaying scores", () => {
  const won = play(sequences.vertical);
  const restored = normalizeState(JSON.parse(JSON.stringify(won)));
  assert.equal(restored.status, "red-won");
  assert.equal(restored.scores.red, 1);
  const undone = undoMove(restored).state;
  const serializedUndo = normalizeState(JSON.parse(JSON.stringify(undone)));
  const redone = redoMove(serializedUndo).state;
  assert.equal(redone.status, "red-won");
  assert.equal(redone.scores.red, 1);
  assert.equal(redone.board[cellIndex(2, 0)], "red");
});
