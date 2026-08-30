import {
  COLUMNS,
  ROWS,
  STORAGE_KEY,
  cellIndex,
  createInitialState,
  dropPiece,
  normalizeState,
  redoMove,
  resetMatch,
  startNextRound,
  undoMove,
} from "./game.js";

const elements = {
  title: document.querySelector("#app-title"),
  subtitle: document.querySelector("#app-subtitle"),
  status: document.querySelector("#round-status"),
  selectedColumn: document.querySelector("#selected-column"),
  columnControls: document.querySelector("#column-controls"),
  board: document.querySelector("#board"),
  feedback: document.querySelector("#feedback"),
  undo: document.querySelector("#undo-button"),
  redo: document.querySelector("#redo-button"),
  nextRound: document.querySelector("#next-round-button"),
  reset: document.querySelector("#reset-button"),
  redScore: document.querySelector("#red-score"),
  yellowScore: document.querySelector("#yellow-score"),
  drawScore: document.querySelector("#draw-score"),
  moveCount: document.querySelector("#move-count"),
  history: document.querySelector("#move-history"),
  emptyHistory: document.querySelector("#empty-history"),
};

let config = null;
let state = loadState();
let activeColumn = 0;
let animatedCell = null;

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function playerName(player) {
  return player === "red" ? "Red" : "Yellow";
}

function playerMarker(player) {
  return player === "red" ? "R" : "Y";
}

function statusText() {
  if (state.status === "red-won") return "Red wins";
  if (state.status === "yellow-won") return "Yellow wins";
  if (state.status === "draw") return "Round drawn";
  return `${playerName(state.currentPlayer)}'s turn`;
}

function buildSurface() {
  elements.columnControls.replaceChildren();
  for (let column = 0; column < COLUMNS; column += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "column-button";
    button.dataset.column = String(column);
    button.innerHTML = `<span class="column-number">${column + 1}</span><span class="preview-token" aria-hidden="true"></span>`;
    button.addEventListener("click", () => {
      activeColumn = column;
      performDrop(column);
    });
    button.addEventListener("focus", () => {
      activeColumn = column;
      renderSelection();
    });
    button.addEventListener("keydown", handleColumnKeydown);
    elements.columnControls.append(button);
  }

  elements.board.replaceChildren();
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.row = String(row);
      cell.dataset.column = String(column);
      cell.dataset.cell = `${row + 1}-${column + 1}`;
      elements.board.append(cell);
    }
  }
}

function renderSelection() {
  elements.selectedColumn.textContent = `Column ${activeColumn + 1} selected`;
  const buttons = [...elements.columnControls.querySelectorAll(".column-button")];
  for (const [column, button] of buttons.entries()) {
    button.tabIndex = column === activeColumn ? 0 : -1;
  }
}

function renderStatus() {
  const terminalPlayer = state.status.endsWith("-won") ? state.status.split("-")[0] : null;
  const tokenPlayer = terminalPlayer || (state.status === "playing" ? state.currentPlayer : null);
  elements.status.dataset.status = state.status;
  elements.status.replaceChildren();
  const token = document.createElement("span");
  token.className = `status-token ${tokenPlayer || "draw"}`;
  token.setAttribute("aria-hidden", "true");
  token.textContent = tokenPlayer ? playerMarker(tokenPlayer) : "=";
  const label = document.createElement("strong");
  label.textContent = statusText();
  elements.status.append(token, label);
}

function renderBoard() {
  const cells = [...elements.board.querySelectorAll(".cell")];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = cellIndex(row, column);
      const cell = cells[index];
      const player = state.board[index];
      cell.className = "cell";
      cell.replaceChildren();
      if (player) {
        cell.classList.add(`${player}-cell`);
        const marker = document.createElement("span");
        marker.className = "token-letter";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = playerMarker(player);
        cell.append(marker);
      }
      if (state.winningCells.includes(index)) cell.classList.add("is-winning");
      if (animatedCell === index) cell.classList.add("is-dropping");
      const winningLabel = state.winningCells.includes(index) ? ", winning" : "";
      cell.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}: ${player ? playerName(player) : "Empty"}${winningLabel}`);
    }
  }
}

function renderControls() {
  const terminal = state.status !== "playing";
  const buttons = [...elements.columnControls.querySelectorAll(".column-button")];
  for (const [column, button] of buttons.entries()) {
    button.disabled = terminal;
    button.setAttribute("aria-label", terminal
      ? `Column ${column + 1}, round complete`
      : `Drop ${playerName(state.currentPlayer)} in column ${column + 1}`);
    const preview = button.querySelector(".preview-token");
    preview.className = `preview-token ${state.currentPlayer}`;
    preview.textContent = playerMarker(state.currentPlayer);
  }
  elements.undo.disabled = state.history.length === 0;
  elements.redo.disabled = state.redo.length === 0 || terminal;
  elements.nextRound.disabled = !terminal;
  renderSelection();
}

function renderScores() {
  elements.redScore.textContent = String(state.scores.red);
  elements.yellowScore.textContent = String(state.scores.yellow);
  elements.drawScore.textContent = String(state.scores.draws);
}

function renderHistory() {
  elements.history.replaceChildren();
  state.history.forEach((move, index) => {
    const item = document.createElement("li");
    item.className = "move-entry";
    item.dataset.move = String(index + 1);
    item.innerHTML = `
      <span class="move-marker ${move.player}" aria-hidden="true">${playerMarker(move.player)}</span>
      <span><strong>${playerName(move.player)}</strong> - column ${move.column + 1}</span>
      <span class="move-number">#${index + 1}</span>`;
    item.setAttribute("aria-label", `Move ${index + 1}: ${playerName(move.player)}, column ${move.column + 1}`);
    elements.history.append(item);
  });
  elements.emptyHistory.hidden = state.history.length > 0;
  elements.moveCount.textContent = `${state.history.length} ${state.history.length === 1 ? "move" : "moves"}`;
}

function render() {
  renderStatus();
  renderBoard();
  renderControls();
  renderScores();
  renderHistory();
}

function setFeedback(message = "", tone = "neutral") {
  elements.feedback.textContent = message;
  elements.feedback.dataset.tone = tone;
}

function acceptMutation(result, feedback = "") {
  if (!result.accepted) return false;
  state = result.state;
  setFeedback(feedback);
  saveState();
  render();
  return true;
}

function performDrop(column) {
  const result = dropPiece(state, column);
  if (!result.accepted) {
    if (result.reason === "column-full") {
      setFeedback(`Column ${column + 1} is full. ${playerName(state.currentPlayer)} still plays.`, "error");
    } else if (result.reason === "round-complete") {
      setFeedback("The round is complete.", "error");
    }
    render();
    focusColumn(column);
    return;
  }
  animatedCell = cellIndex(result.move.row, result.move.column);
  const resultMessage = result.state.status.endsWith("-won")
    ? `${playerName(result.move.player)} wins the round.`
    : result.state.status === "draw"
      ? "The round is a draw."
      : "";
  acceptMutation(result, resultMessage);
  if (resultMessage) elements.feedback.dataset.tone = "result";
  focusColumn(column);
}

function focusColumn(column) {
  const button = elements.columnControls.querySelector(`[data-column="${column}"]`);
  if (button && !button.disabled) button.focus({ preventScroll: true });
}

function handleColumnKeydown(event) {
  let destination = activeColumn;
  if (event.key === "ArrowLeft") destination = Math.max(0, activeColumn - 1);
  else if (event.key === "ArrowRight") destination = Math.min(COLUMNS - 1, activeColumn + 1);
  else if (event.key === "Home") destination = 0;
  else if (event.key === "End") destination = COLUMNS - 1;
  else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    performDrop(activeColumn);
    return;
  } else return;

  event.preventDefault();
  activeColumn = destination;
  renderSelection();
  focusColumn(destination);
}

elements.undo.addEventListener("click", () => {
  animatedCell = null;
  if (acceptMutation(undoMove(state), "Last move undone.")) focusColumn(activeColumn);
});

elements.redo.addEventListener("click", () => {
  const result = redoMove(state);
  if (result.accepted) {
    animatedCell = cellIndex(result.move.row, result.move.column);
    acceptMutation(result, "Move restored.");
    focusColumn(activeColumn);
  }
});

elements.nextRound.addEventListener("click", () => {
  animatedCell = null;
  if (acceptMutation(startNextRound(state), "New round started.")) {
    activeColumn = 0;
    render();
    focusColumn(0);
  }
});

elements.reset.addEventListener("click", () => {
  animatedCell = null;
  state = resetMatch().state;
  activeColumn = 0;
  setFeedback("Match reset.");
  saveState();
  render();
  focusColumn(0);
});

async function bootstrap() {
  try {
    const response = await fetch("/api/config");
    config = await response.json();
    elements.title.textContent = config.title;
    elements.subtitle.textContent = config.subtitle;
    document.title = config.title;
  } catch {
    config = { title: "DropLine", subtitle: "Four in a Row" };
  }
  buildSurface();
  render();
}

bootstrap();
