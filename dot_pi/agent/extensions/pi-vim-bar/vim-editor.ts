/**
 * VimEditor - Modal vim editor extending CustomEditor.
 * Routes input to mode-specific handlers and renders mode indicator.
 */

import { CustomEditor } from "@earendil-works/pi-coding-agent";
import {
  CURSOR_MARKER,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import type { TUI, EditorOptions, EditorTheme, AutocompleteProvider } from "@earendil-works/pi-tui";
import { createInitialState, modeDisplayName, type VimState } from "./state.js";
import { handleNormalMode, type NormalModeContext } from "./modes/normal.js";
import { handleInsertMode, type InsertModeContext } from "./modes/insert.js";
import { handleReplaceMode, resetReplaceState, type ReplaceModeContext } from "./modes/replace.js";
import { handleVisualMode, getVisualRange, type VisualModeContext } from "./modes/visual.js";
import { ESCAPE_SEQS } from "./keys.js";
import {
  handleSearchInput,
  getSearchPrompt,
  getSearchState,
  executeSearchMotion,
} from "./search.js";

export class VimEditor extends CustomEditor {
  public vimState: VimState;
  private redoStack: Array<{ lines: string[]; cursorLine: number; cursorCol: number }> = [];
  private wrapAutocomplete: ((provider: AutocompleteProvider) => AutocompleteProvider) | undefined;
  private readonly defaultShowHardwareCursor: boolean;
  private hardwareCursorShape: string | undefined;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: any,
    options?: EditorOptions,
    wrapAutocomplete?: (provider: AutocompleteProvider) => AutocompleteProvider,
  ) {
    super(tui, theme, keybindings, options);
    this.defaultShowHardwareCursor = tui.getShowHardwareCursor();
    this.vimState = createInitialState();
    this.wrapAutocomplete = wrapAutocomplete;
    this.syncHardwareCursor();
  }

  /**
   * Wrap the autocomplete provider with fuzzy file matching for @ queries.
   * This integrates pi-fzfp's weighted dual-key scoring into the vim editor.
   */
  override setAutocompleteProvider(provider: AutocompleteProvider): void {
    super.setAutocompleteProvider(this.wrapAutocomplete ? this.wrapAutocomplete(provider) : provider);
  }

  /**
   * Undo: snapshot current state to redo stack, then perform base editor undo.
   * Works at the same level as the base editor's internal state.
   */
  vimUndo(): void {
    const editor = this as any;
    if (!editor.undoStack || editor.undoStack.length === 0) return;

    // Save current internal state to redo stack before undoing
    const state = editor.state;
    this.redoStack.push(structuredClone(state));

    // Perform base editor undo
    editor.undo();
  }

  /**
   * Redo: restore state from redo stack, push current state to undo stack.
   * Mirrors the base editor's undo mechanism in reverse.
   */
  vimRedo(): void {
    if (this.redoStack.length === 0) return;
    const editor = this as any;
    const snapshot = this.redoStack.pop()!;

    // Push current state to undo stack
    editor.undoStack.push(structuredClone(editor.state));

    // Restore the redo snapshot directly into internal state
    Object.assign(editor.state, snapshot);
    editor.lastAction = null;
    editor.preferredVisualCol = null;
    if (editor.onChange) {
      editor.onChange(this.getText());
    }
  }

  handleInput(data: string): void {
    const { vimState } = this;
    const textBefore = this.getText();
    const redoStackBefore = this.redoStack.length;

    switch (vimState.mode) {
      case "insert":
        this.handleInsert(data);
        break;

      case "replace":
        this.handleReplace(data);
        break;

      case "normal":
        this.handleNormal(data);
        break;

      case "visual":
      case "visual-line":
        this.handleVisual(data);
        break;

      case "command-line":
        this.handleCommandLine(data);
        break;

      default:
        // For unimplemented modes, pass through to super
        super.handleInput(data);
        break;
    }

    // Clear redo stack when text changes from a non-undo/redo action.
    // If the redo stack changed size, it was an undo/redo operation — don't clear.
    if (this.redoStack.length === redoStackBefore && this.getText() !== textBefore) {
      this.redoStack.length = 0;
    }

    this.syncHardwareCursor();
  }

  private syncHardwareCursor(): void {
    const shape = cursorShapeForMode(this.vimState.mode);

    // This fork intentionally uses the terminal hardware cursor for all vim
    // modes. Keep it enabled regardless of pi's global hardware-cursor setting
    // while this editor is active.
    this.tui.setShowHardwareCursor(true);

    if (this.hardwareCursorShape === shape) return;
    this.hardwareCursorShape = shape;
    this.tui.terminal.write(shape);
  }

  restoreHardwareCursor(): void {
    this.tui.setShowHardwareCursor(this.defaultShowHardwareCursor);
    this.tui.terminal.write("\x1b[0 q"); // restore terminal default cursor shape
    this.hardwareCursorShape = undefined;
  }

  private handleInsert(data: string): void {
    const ctx: InsertModeContext = {
      state: this.vimState,
      getCursor: () => this.getCursor(),
      superHandleInput: (d) => super.handleInput(d),
    };
    handleInsertMode(data, ctx);
  }

  private handleReplace(data: string): void {
    const ctx: ReplaceModeContext = {
      state: this.vimState,
      getCursor: () => this.getCursor(),
      getText: () => this.getText(),
      setText: (text) => this.setText(text),
      moveCursorTo: (line, col) => this.moveCursorTo(line, col),
      superHandleInput: (d) => super.handleInput(d),
    };
    handleReplaceMode(data, ctx);
  }

  private handleNormal(data: string): void {
    // Escape in normal mode → pass to super (abort agent, etc.)
    if (matchesKey(data, "escape")) {
      super.handleInput(data);
      return;
    }

    const ctx: NormalModeContext = {
      state: this.vimState,
      superHandleInput: (d) => super.handleInput(d),
      getText: () => this.getText(),
      getCursor: () => this.getCursor(),
      setText: (text) => this.setText(text),
      moveCursorTo: (line, col) => this.moveCursorTo(line, col),
      undo: () => this.vimUndo(),
      redo: () => this.vimRedo(),
    };
    handleNormalMode(data, ctx);
  }

  private handleCommandLine(data: string): void {
    const state = getSearchState();
    const returnMode = state.returnMode;
    const result = handleSearchInput(data);

    if (result === "confirm") {
      // Execute the search and move cursor to the match
      const lines = this.getText().split("\n");
      const cursor = this.getCursor();
      const motionResult = executeSearchMotion(lines, cursor);
      this.moveCursorTo(motionResult.position.line, motionResult.position.col);
      this.vimState.mode = returnMode;
    } else if (result === "cancel") {
      this.vimState.mode = "normal";
      this.vimState.visualAnchor = null;
    }
    // "continue" → stay in command-line mode, render will show the prompt
  }

  private handleVisual(data: string): void {
    const ctx: VisualModeContext = {
      state: this.vimState,
      superHandleInput: (d) => super.handleInput(d),
      getText: () => this.getText(),
      getCursor: () => this.getCursor(),
      setText: (text) => this.setText(text),
      moveCursorTo: (line, col) => this.moveCursorTo(line, col),
    };
    handleVisualMode(data, ctx);
  }

  /**
   * Move cursor to an absolute position by using escape sequences.
   * Re-reads getCursor() for accurate positioning (important after setText which moves to end).
   */
  moveCursorTo(targetLine: number, targetCol: number): void {
    const current = this.getCursor();

    // Move vertically
    if (targetLine < current.line) {
      for (let i = current.line; i > targetLine; i--) {
        super.handleInput(ESCAPE_SEQS.up);
      }
    } else if (targetLine > current.line) {
      for (let i = current.line; i < targetLine; i++) {
        super.handleInput(ESCAPE_SEQS.down);
      }
    }

    // Move to line start, then right to target column
    super.handleInput(ESCAPE_SEQS.home);
    for (let i = 0; i < targetCol; i++) {
      super.handleInput(ESCAPE_SEQS.right);
    }
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    // Apply visual selection highlighting if in visual mode
    // Also keep highlighting when in command-line mode initiated from visual
    const isVisual = this.vimState.mode === "visual" || this.vimState.mode === "visual-line";
    const isSearchFromVisual =
      this.vimState.mode === "command-line" &&
      (getSearchState().returnMode === "visual" || getSearchState().returnMode === "visual-line");
    if ((isVisual || isSearchFromVisual) && this.vimState.visualAnchor) {
      this.applyVisualHighlight(lines, width);
    }

    // Let the terminal hardware cursor render every vim mode. Remove pi-tui's
    // fake inverse-video cursor, and ensure a CURSOR_MARKER exists so pi-tui
    // positions the hardware cursor at the editor cursor cell.
    stripFakeCursorForHardware(lines);

    // Add mode indicator to the bottom border (right side)
    const last = lines.length - 1;

    if (this.vimState.mode === "command-line" && getSearchState().active) {
      // Show search prompt on the bottom border
      const prompt = getSearchPrompt();
      const cursorChar = "█";
      const promptWithCursor = ` ${prompt}${cursorChar} `;
      if (visibleWidth(lines[last]!) >= promptWithCursor.length) {
        lines[last] =
          truncateToWidth(lines[last]!, width - promptWithCursor.length, "") +
          promptWithCursor;
      }
    } else {
      const label = modeLabelForMode(this.vimState.mode);
      const labelWidth = visibleWidth(label);
      if (visibleWidth(lines[last]!) >= labelWidth) {
        lines[last] =
          truncateToWidth(lines[last]!, width - labelWidth, "") + label;
      }
    }

    return lines;
  }

  /**
   * Apply reverse-video highlighting to the visual selection range in rendered output.
   *
   * The rendered output from super.render() is structured as:
   *   [top border, ...content lines (with padding), bottom border, ...autocomplete]
   *
   * Content lines have format: `${leftPadding}${displayText}${rightPadding}`
   * where padding is `paddingX` spaces on each side (default 0).
   * The editor also inserts CURSOR_MARKER (APC sequence) and cursor highlighting.
   *
   * We use pi-tui's extractAnsiCode to properly skip ALL escape sequences
   * (CSI, OSC, APC) when counting visible positions.
   */
  private applyVisualHighlight(renderedLines: string[], width: number): void {
    const text = this.getText();
    const textLines = text.split("\n");
    const cursor = this.getCursor();
    const range = getVisualRange(this.vimState, cursor, textLines);

    // The editor uses paddingX (default 0) for left/right content padding.
    // With paddingX=0: contentWidth = width, layoutWidth = width - 1
    // Content lines start at renderedLines[1] through renderedLines[length-2].
    // The padding property is accessed via getPadding().
    const paddingX = this.getPaddingX();
    const contentWidth = Math.max(1, width - paddingX * 2);
    const layoutWidth = Math.max(1, contentWidth - (paddingX ? 0 : 1));

    // Map text line index → first rendered line index (1-based, after top border)
    const textLineToRenderedStart: number[] = [];
    let renderedIdx = 1; // skip top border
    for (let i = 0; i < textLines.length; i++) {
      textLineToRenderedStart.push(renderedIdx);
      const lineLen = Math.max(1, visibleWidth(textLines[i] || ""));
      const wrappedCount = Math.ceil(lineLen / layoutWidth);
      renderedIdx += wrappedCount;
    }

    // Highlight the selected ranges
    for (let textLine = range.start.line; textLine <= range.end.line; textLine++) {
      const lineText = textLines[textLine] || "";
      const renderedStart = textLineToRenderedStart[textLine];
      if (renderedStart === undefined) continue;

      let selStartCol: number;
      let selEndCol: number;

      if (range.linewise) {
        selStartCol = 0;
        selEndCol = lineText.length;
      } else {
        selStartCol = textLine === range.start.line ? range.start.col : 0;
        selEndCol =
          textLine === range.end.line ? range.end.col + 1 : lineText.length;
      }

      // Apply highlighting across wrapped lines
      const lineLen = Math.max(1, lineText.length);
      const wrappedCount = Math.ceil(lineLen / layoutWidth);

      for (let wrap = 0; wrap < wrappedCount; wrap++) {
        const rIdx = renderedStart + wrap;
        if (rIdx >= renderedLines.length - 1) break; // don't touch bottom border

        const wrapStartCol = wrap * layoutWidth;
        const wrapEndCol = wrapStartCol + layoutWidth;

        // Intersection of selection with this wrapped segment
        const hlStart = Math.max(selStartCol, wrapStartCol) - wrapStartCol;
        const hlEnd = Math.min(selEndCol, wrapEndCol) - wrapStartCol;

        if (hlStart < hlEnd) {
          // Offset by paddingX for left padding
          renderedLines[rIdx] = highlightRenderedLine(
            renderedLines[rIdx]!,
            hlStart + paddingX,
            hlEnd + paddingX,
          );
        }
      }
    }
  }
}

const BASE_CURSOR_START = "\x1b[7m";
const BASE_CURSOR_END = "\x1b[0m";

const ANSI_RESET = "\x1b[0m";
// Catppuccin Macchiato palette:
// green=#a6da95, peach=#f5a97f, mauve=#c6a0f6
const MODE_GREEN = "\x1b[38;2;166;218;149m";
const MODE_ORANGE = "\x1b[38;2;245;169;127m";
const MODE_PURPLE = "\x1b[38;2;198;160;246m";

function modeLabelForMode(mode: VimState["mode"]): string {
  const modeName = modeDisplayName(mode);
  const label = ` ${modeName} `;

  switch (mode) {
    case "insert":
      return `${MODE_GREEN}${label}${ANSI_RESET}`;
    case "normal":
      return `${MODE_ORANGE}${label}${ANSI_RESET}`;
    case "visual":
    case "visual-line":
      return `${MODE_PURPLE}${label}${ANSI_RESET}`;
    default:
      return label;
  }
}

function cursorShapeForMode(mode: VimState["mode"]): string {
  switch (mode) {
    case "insert":
    case "command-line":
      return "\x1b[5 q"; // blinking bar
    case "replace":
      return "\x1b[3 q"; // blinking underline
    case "normal":
    case "visual":
    case "visual-line":
    case "operator-pending":
    default:
      return "\x1b[1 q"; // blinking block
  }
}

/**
 * Remove pi-tui's fake inverse-video cursor and leave/insert CURSOR_MARKER at
 * the same position. TUI strips that marker later and moves the terminal's
 * hardware cursor there.
 */
function stripFakeCursorForHardware(lines: string[]): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const markerIndex = line.indexOf(CURSOR_MARKER);
    const searchFrom = markerIndex === -1 ? 0 : markerIndex + CURSOR_MARKER.length;

    const start = line.indexOf(BASE_CURSOR_START, searchFrom);
    if (start === -1) continue;

    const cursorCellStart = start + BASE_CURSOR_START.length;
    const end = line.indexOf(BASE_CURSOR_END, cursorCellStart);
    if (end === -1) continue;

    const cursorCell = line.slice(cursorCellStart, end);
    const marker = markerIndex === -1 ? CURSOR_MARKER : "";
    lines[i] = line.slice(0, start) + marker + cursorCell + line.slice(end + BASE_CURSOR_END.length);
    return;
  }
}

/**
 * Detect an escape sequence at position `pos` in `str`.
 * Returns the length of the escape sequence, or 0 if none found.
 *
 * Handles:
 * - CSI sequences: \x1b[ ... m/G/K/H/J
 * - OSC sequences: \x1b] ... BEL or \x1b] ... ST(\x1b\\)
 * - APC sequences: \x1b_ ... BEL or \x1b_ ... ST(\x1b\\)
 */
function escapeSeqLength(str: string, pos: number): number {
  if (pos >= str.length || str[pos] !== "\x1b") return 0;
  const next = str[pos + 1];

  // CSI: \x1b[ ... terminator
  if (next === "[") {
    let j = pos + 2;
    while (j < str.length && !/[mGKHJ]/.test(str[j]!)) j++;
    if (j < str.length) return j + 1 - pos;
    return 0;
  }

  // OSC: \x1b] ... BEL or ST
  if (next === "]") {
    let j = pos + 2;
    while (j < str.length) {
      if (str[j] === "\x07") return j + 1 - pos;
      if (str[j] === "\x1b" && str[j + 1] === "\\") return j + 2 - pos;
      j++;
    }
    return 0;
  }

  // APC: \x1b_ ... BEL or ST
  if (next === "_") {
    let j = pos + 2;
    while (j < str.length) {
      if (str[j] === "\x07") return j + 1 - pos;
      if (str[j] === "\x1b" && str[j + 1] === "\\") return j + 2 - pos;
      j++;
    }
    return 0;
  }

  return 0;
}

/**
 * Insert reverse-video ANSI codes into a rendered line at specific visible column positions.
 * Properly handles CSI, OSC, and APC escape sequences (including CURSOR_MARKER).
 *
 * When the cursor falls inside the highlighted range, the editor's cursor rendering
 * inserts `\x1b[0m` (full reset) after the cursor character, which would kill the
 * reverse video for the rest of the selection. We detect this and re-inject `\x1b[7m`
 * after any SGR reset that falls within the highlighted range.
 *
 * `startVisCol` and `endVisCol` are 0-indexed visible column positions to highlight.
 */
function highlightRenderedLine(
  line: string,
  startVisCol: number,
  endVisCol: number,
): string {
  let result = "";
  let visCol = 0;
  let i = 0;
  let started = false;
  let ended = false;

  while (i < line.length) {
    // Check for any escape sequence (CSI, OSC, APC)
    const seqLen = escapeSeqLength(line, i);
    if (seqLen > 0) {
      // Insert highlight markers before this escape sequence if needed
      if (!started && visCol >= startVisCol) {
        result += "\x1b[7m";
        started = true;
      }
      if (started && !ended && visCol >= endVisCol) {
        result += "\x1b[27m";
        ended = true;
      }

      const seq = line.substring(i, i + seqLen);
      result += seq;

      // If we're inside the highlight range and this is a SGR reset (\x1b[0m),
      // re-inject reverse video to keep the selection highlighted.
      // The editor's cursor rendering uses \x1b[0m after the cursor character,
      // which would otherwise kill our reverse video.
      if (started && !ended && isResetSequence(seq)) {
        result += "\x1b[7m";
      }

      i += seqLen;
      continue;
    }

    // Insert highlight markers at the right visible positions
    if (!started && visCol === startVisCol) {
      result += "\x1b[7m";
      started = true;
    }
    if (started && !ended && visCol === endVisCol) {
      result += "\x1b[27m";
      ended = true;
    }

    result += line[i];
    // Only count printable characters as visible
    const code = line.charCodeAt(i);
    if (code >= 0x20) {
      visCol++;
    }
    i++;
  }

  // Close highlight if we reached end of line before endVisCol
  if (started && !ended) {
    result += "\x1b[27m";
  }

  return result;
}

/**
 * Check if an ANSI sequence is an SGR reset that would clear reverse video.
 * Matches \x1b[0m and \x1b[m (both are full SGR resets).
 */
function isResetSequence(seq: string): boolean {
  return seq === "\x1b[0m" || seq === "\x1b[m";
}
