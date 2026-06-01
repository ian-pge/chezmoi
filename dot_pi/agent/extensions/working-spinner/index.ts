/**
 * working-spinner Extension
 *
 * Overhauls pi's streaming working indicator with customizable
 * spinner frames and rotating status verbs — inspired by Claude Code.
 *
 * ─── Commands ─────────────────────────────────────────────────────
 *   /spinner                    Show current status
 *   /spinner <name>             Frame preset (claude|braille|pulse|dot|star|none)
 *   /spinner frames <list>      Custom frames (comma-separated)
 *   /spinner interval <n>       Frame interval in ms
 *
 *   /verbs                      Show current verb preset
 *   /verbs <name>               Verb preset (claude|short|technical|fun|none)
 *   /verbs add <v1,...>         Append custom verbs
 *   /verbs replace <...>        Replace verb list entirely
 *
 * ─── Settings ─────────────────────────────────────────────────────
 *   .pi/settings.json → workingSpinner key
 *
 * Installation:
 *   Place in .pi/extensions/working-spinner/ and restart pi.
 */

import type { AutocompleteItem } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext, WorkingIndicatorOptions } from "@earendil-works/pi-coding-agent";
import {
	FRAME_PRESETS,
	VERB_PRESETS,
	COMPLETION_VERBS,
	randomItem,
	formatFrames,
	getFrameConfig,
	getVerbList,
	type FramePreset,
	type VerbPreset,
} from "./data.js";

// ─── Config ───────────────────────────────────────────────────────

interface Config {
	frames: FramePreset | "custom";
	customFrames?: string[];
	frameIntervalMs: number;
	verbs: VerbPreset | "custom";
	customVerbList?: string[];
	verbRotationIntervalMs: number;
	showCompletionVerb: boolean;
	completionVerbDurationMs: number;
}

const DEFAULT_CONFIG: Config = {
	frames: "pulse",
	frameIntervalMs: 150,
	verbs: "claude",
	verbRotationIntervalMs: 3000,
	showCompletionVerb: false,
	completionVerbDurationMs: 2000,
};

// ─── Hard-coded config ────────────────────────────────────────────
// This local extension intentionally does not read or write any
// .pi/settings.json file. Change DEFAULT_CONFIG above to customize it.

function readConfig(_cwd: string): Config {
	return { ...DEFAULT_CONFIG };
}

function writeConfig(_cwd: string, _config: Config): void {
	// Settings are intentionally not persisted. Edit DEFAULT_CONFIG instead.
}

// ─── Build indicator options from config ──────────────────────────

function getRawFrames(config: Config): string[] {
	if (config.frames === "custom" && config.customFrames && config.customFrames.length > 0) {
		return config.customFrames;
	}
	return getFrameConfig(config.frames).frames;
}

const CATPPUCCIN_MACCHIATO_ROSEWATER = "#f5bde6";

function colorHex(hex: string, text: string): string {
	const [r, g, b] = hexToRgb(hex);
	return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function colorizeFrames(frames: string[], _ctx: ExtensionContext): string[] {
	return frames.map((f) => (f ? colorHex(CATPPUCCIN_MACCHIATO_ROSEWATER, f) : f));
}

function buildVerbList(config: Config): string[] {
	if (config.verbs === "custom" && config.customVerbList && config.customVerbList.length > 0) {
		return config.customVerbList;
	}
	return getVerbList(config.verbs);
}

// ─── Status display helpers ───────────────────────────────────────

function describeFramePreset(config: Config): string {
	if (config.frames === "custom") {
		return `custom [${formatFrames(config.customFrames ?? [])}] @${config.frameIntervalMs}ms`;
	}
	const preset = FRAME_PRESETS[config.frames as FramePreset];
	return `${config.frames} [${formatFrames(preset?.frames ?? [])}] @${preset?.intervalMs ?? config.frameIntervalMs}ms`;
}

function describeVerbPreset(config: Config): string {
	if (config.verbs === "custom") {
		return `custom (${config.customVerbList?.length ?? 0} verbs)`;
	}
	return `${config.verbs} (${(VERB_PRESETS[config.verbs as VerbPreset] ?? []).length} verbs)`;
}

// ─── Shimmer Helpers (gentle color sweep, 200ms intervals) ────────

const SHIMMER_INTERVAL_MS = 200;
const SHIMMER_BAND_WIDTH = 4;

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16),
	];
}

function blendColors(
	c1: [number, number, number],
	c2: [number, number, number],
	t: number,
): [number, number, number] {
	return [
		Math.round(c1[0] + (c2[0] - c1[0]) * t),
		Math.round(c1[1] + (c2[1] - c1[1]) * t),
		Math.round(c1[2] + (c2[2] - c1[2]) * t),
	];
}

function lightenRgb(r: number, g: number, b: number, amount: number): [number, number, number] {
	return [
		Math.min(255, Math.round(r + (255 - r) * amount)),
		Math.min(255, Math.round(g + (255 - g) * amount)),
		Math.min(255, Math.round(b + (255 - b) * amount)),
	];
}

/** Extract hex color from current theme by parsing ctx.ui.theme.fg() output */
function getThemeAccentHex(_ctx: ExtensionContext): string | null {
	return CATPPUCCIN_MACCHIATO_ROSEWATER;
}

/** Per-character ANSI color sweep — moving highlight across verb text */
function colorSweep(
	text: string,
	frame: number,
	baseHex: string,
	shimmerHex: string,
): string {
	const base = hexToRgb(baseHex);
	const shimmer = hexToRgb(shimmerHex);
	const ellipsis = text.endsWith("...") ? "..." : "";
	const sweepText = ellipsis ? text.slice(0, -3) : text;
	const totalWidth = sweepText.length + SHIMMER_BAND_WIDTH * 2;
	const pos = frame % totalWidth;

	let result = "";
	for (let i = 0; i < sweepText.length; i++) {
		const dist = Math.abs(i - pos);
		const t = Math.max(0, 1 - dist / SHIMMER_BAND_WIDTH);
		const color = blendColors(base, shimmer, t);
		result += `\x1b[38;2;${color[0]};${color[1]};${color[2]}m${sweepText[i]}\x1b[0m`;
	}
	return result + (ellipsis ? colorHex(baseHex, ellipsis) : "");
}

// ─── Extension ────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let config: Config = { ...DEFAULT_CONFIG };

	// Verb rotation timer
	let verbTimer: ReturnType<typeof setInterval> | null = null;
	let currentVerbList: string[] = [];

	// Shimmer animation
	let shimmerTimer: ReturnType<typeof setInterval> | null = null;
	let shimmerFrame = 0;
	let currentVerbText = "";
	let accentHex: string | null = null;
	let shimmerHex: string | null = null;

	// Keep a fresh ctx reference (updated on each event) for the interval callback
	let currentCtx: ExtensionContext | null = null;

	// Completion verb timeout — cancelled on agent_start to avoid stale ctx
	let completionTimer: ReturnType<typeof setTimeout> | null = null;
	let isExtensionActive = true;

	// ── Shimmer ────────────────────────────────────────────────

	function resolveShimmerColors(ctx: ExtensionContext) {
		const hex = getThemeAccentHex(ctx);
		if (hex) {
			accentHex = hex;
			const [r, g, b] = hexToRgb(hex);
			const lightened = lightenRgb(r, g, b, 0.5);
			shimmerHex = `#${lightened[0].toString(16).padStart(2, "0")}${lightened[1].toString(16).padStart(2, "0")}${lightened[2].toString(16).padStart(2, "0")}`;
		} else {
			accentHex = null;
			shimmerHex = null;
		}
	}

	function updateShimmer() {
		if (!currentCtx || !currentVerbText) return;
		// Pause shimmer when agent is idle (e.g. waiting for sub-agent)
		if (currentCtx.isIdle()) return;
		const baseHex = CATPPUCCIN_MACCHIATO_ROSEWATER;
		const shimmerHex = "#ffffff";
		const colored = colorSweep(currentVerbText, shimmerFrame, baseHex, shimmerHex);
		currentCtx.ui.setWorkingMessage(colored);
		shimmerFrame += 2;
	}

	function startShimmer(ctx: ExtensionContext) {
		stopShimmer();
		currentCtx = ctx;
		resolveShimmerColors(ctx);
		shimmerFrame = 0;
		if (currentVerbText) updateShimmer();
		shimmerTimer = setInterval(updateShimmer, SHIMMER_INTERVAL_MS);
	}

	function stopShimmer() {
		if (shimmerTimer !== null) {
			clearInterval(shimmerTimer);
			shimmerTimer = null;
		}
	}

	// ── Helpers ─────────────────────────────────────────────────

	function applyIndicator(ctx: ExtensionContext) {
		const raw = getRawFrames(config);
		const colored = colorizeFrames(raw, ctx);
		ctx.ui.setWorkingIndicator({ frames: colored, intervalMs: config.frameIntervalMs });
		resolveShimmerColors(ctx);
	}

	function pickVerb(): string {
		if (currentVerbList.length === 0) return "";
		return `${randomItem(currentVerbList)}...`;
	}

	function rotateVerb() {
		if (currentVerbList.length === 0) return;
		if (!currentCtx) return;
		currentVerbText = pickVerb();
		// Render immediately so new verb shows up even if shimmer is paused
		updateShimmer();
	}

	function startVerbRotation(ctx: ExtensionContext) {
		stopVerbRotation();
		currentCtx = ctx;
		currentVerbList = buildVerbList(config);
		if (currentVerbList.length === 0) return;

		// Set first verb immediately
		rotateVerb();

		// Start shimmer animation (color sweep across verb text)
		startShimmer(ctx);

		// Rotate verb at interval
		verbTimer = setInterval(rotateVerb, config.verbRotationIntervalMs);
	}

	function stopVerbRotation() {
		if (verbTimer !== null) {
			clearInterval(verbTimer);
			verbTimer = null;
		}
		stopShimmer();
		if (currentCtx) {
			currentCtx.ui.setWorkingMessage(undefined);
		}
	}

	function cancelCompletionVerb() {
		if (completionTimer !== null) {
			clearTimeout(completionTimer);
			completionTimer = null;
		}
	}

	function showCompletionVerb(ctx: ExtensionContext) {
		if (!config.showCompletionVerb) return;
		cancelCompletionVerb();
		const verb = randomItem(COMPLETION_VERBS);
		const check = ctx.ui.theme.fg("success", "✓");
		const word = colorHex(CATPPUCCIN_MACCHIATO_ROSEWATER, verb);
		ctx.ui.setStatus("spinner", `${check} ${word}`);

		completionTimer = setTimeout(() => {
			completionTimer = null;
			if (!isExtensionActive) return;
			ctx.ui.setStatus("spinner", undefined);
		}, config.completionVerbDurationMs);
	}

	function hookCtx(ctx: ExtensionContext) {
		currentCtx = ctx;
	}

	// ── Event Hooks ─────────────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		hookCtx(ctx);
		config = readConfig(ctx.cwd);
		currentVerbList = buildVerbList(config);
		isExtensionActive = true;
		cancelCompletionVerb();

		applyIndicator(ctx);

		// Reset working message to default (our rotation takes over on agent_start)
		ctx.ui.setWorkingMessage(undefined);
	});

	pi.on("agent_start", async (_event, ctx) => {
		hookCtx(ctx);
		cancelCompletionVerb();

		config = readConfig(ctx.cwd);
		applyIndicator(ctx);
		startVerbRotation(ctx);
	});

	pi.on("turn_end", async (_event, ctx) => {
		hookCtx(ctx);
		rotateVerb();
	});

	pi.on("agent_end", async (_event, ctx) => {
		hookCtx(ctx);
		stopVerbRotation();
		showCompletionVerb(ctx);
		ctx.ui.setWorkingMessage(undefined);
	});

	pi.on("session_shutdown", async () => {
		isExtensionActive = false;
		currentCtx = null;
		stopVerbRotation();
		cancelCompletionVerb();
	});

	// ── Commands ───────────────────────────────────────────────

	pi.registerCommand("spinner", {
		description: "Configure working spinner frames. See /spinner for details.",
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			const items: AutocompleteItem[] = [
				{ value: "claude", label: "claude", description: "· ✢ ✳ ✶ ✻ ✽" },
				{ value: "braille", label: "braille", description: "⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏" },
				{ value: "pulse", label: "pulse", description: "· • ● •" },
				{ value: "dot", label: "dot", description: "● (static)" },
				{ value: "star", label: "star", description: "✧ ★ ✦ ✶ ✹" },
				{ value: "none", label: "none", description: "Hide indicator" },
				{ value: "frames ", label: "frames", description: "Custom comma-separated frames" },
				{ value: "interval ", label: "interval", description: "Set frame interval in ms" },
			];
			const first = prefix.split(/\s+/)[0]?.toLowerCase() ?? "";
			if (first === "frames" || first === "interval") return null; // free text input
			const filtered = prefix
				? items.filter((i) => i.value.startsWith(prefix.toLowerCase()))
				: items;
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			hookCtx(ctx);
			const trimmed = args.trim();
			if (!trimmed) {
				ctx.ui.notify(
					`Frames: ${describeFramePreset(config)}  |  ${describeVerbPreset(config)}`,
					"info",
				);
				return;
			}

			const parts = trimmed.split(/\s+/);
			const sub = parts[0]!.toLowerCase();

			if (sub === "frames" && parts.length > 1) {
				const frameList = parts.slice(1).join("").split(",").map((s) => s.trim()).filter(Boolean);
				if (frameList.length === 0) {
					ctx.ui.notify("Usage: /spinner frames f1,f2,f3,...", "error");
					return;
				}
				config.frames = "custom";
				config.customFrames = frameList;
				applyIndicator(ctx);
				writeConfig(ctx.cwd, config);
				ctx.ui.notify(`Custom frames set: ${formatFrames(frameList)}`, "success");
				return;
			}

			if (sub === "interval" && parts.length > 1) {
				const n = parseInt(parts[1]!, 10);
				if (isNaN(n) || n < 0) {
					ctx.ui.notify("Usage: /spinner interval <ms> (>= 0)", "error");
					return;
				}
				config.frameIntervalMs = n;
				applyIndicator(ctx);
				writeConfig(ctx.cwd, config);
				ctx.ui.notify(`Frame interval set to ${n}ms`, "success");
				return;
			}

			// Frame preset name
			const validPresets: FramePreset[] = ["claude", "braille", "pulse", "barPulse", "dot", "star", "none"];
			const match = validPresets.find((p) => p === sub);
			if (match) {
				config.frames = match;
				config.frameIntervalMs = FRAME_PRESETS[match].intervalMs;
				applyIndicator(ctx);
				writeConfig(ctx.cwd, config);
				const label = match === "none" ? "hidden" : match;
				ctx.ui.notify(`Spinner frames: ${label}`, "success");
				return;
			}

			ctx.ui.notify(
				"Usage: /spinner [claude|braille|pulse|barPulse|dot|star|none|frames f1,f2,...|interval <ms>]",
				"error",
			);
		},
	});

	pi.registerCommand("verbs", {
		description: "Configure working spinner verbs. See /verbs for details.",
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			const items: AutocompleteItem[] = [
				{ value: "claude", label: "claude", description: "187 verbs (full Claude Code list)" },
				{ value: "short", label: "short", description: "6 focused verbs" },
				{ value: "technical", label: "technical", description: "12 dev-focused verbs" },
				{ value: "fun", label: "fun", description: "23 whimsical verbs" },
				{ value: "none", label: "none", description: "No verb rotation" },
				{ value: "add ", label: "add", description: "Append custom verbs v1,v2,..." },
				{ value: "replace ", label: "replace", description: "Replace with custom verbs v1,v2,..." },
			];
			const first = prefix.split(/\s+/)[0]?.toLowerCase() ?? "";
			if (first === "add" || first === "replace") return null; // free text input
			const filtered = prefix
				? items.filter((i) => i.value.startsWith(prefix.toLowerCase()))
				: items;
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			hookCtx(ctx);
			const trimmed = args.trim();
			if (!trimmed) {
				const list = buildVerbList(config);
				ctx.ui.notify(
					`Verbs: ${describeVerbPreset(config)}  | first few: ${list.slice(0, 5).join(", ")}${
						list.length > 5 ? ", ..." : ""
					}`,
					"info",
				);
				return;
			}

			const parts = trimmed.split(/\s+/);
			const sub = parts[0]!.toLowerCase();

			if (sub === "add" && parts.length > 1) {
				const extra = parts.slice(1).join("").split(",").map((s) => s.trim()).filter(Boolean);
				if (extra.length === 0) {
					ctx.ui.notify("Usage: /verbs add v1,v2,v3,...", "error");
					return;
				}
				const current = buildVerbList(config);
				config.verbs = "custom";
				config.customVerbList = [...current, ...extra];
				writeConfig(ctx.cwd, config);
				ctx.ui.notify(`Appended ${extra.length} verbs (total: ${config.customVerbList.length})`, "success");
				return;
			}

			if (sub === "replace" && parts.length > 1) {
				const list = parts.slice(1).join("").split(",").map((s) => s.trim()).filter(Boolean);
				if (list.length === 0) {
					ctx.ui.notify("Usage: /verbs replace v1,v2,v3,...", "error");
					return;
				}
				config.verbs = "custom";
				config.customVerbList = list;
				writeConfig(ctx.cwd, config);
				ctx.ui.notify(`Replaced with ${list.length} custom verbs`, "success");
				return;
			}

			const validPresets: VerbPreset[] = ["claude", "short", "technical", "fun", "none"];
			const match = validPresets.find((p) => p === sub);
			if (match) {
				config.verbs = match;
				delete config.customVerbList;
				writeConfig(ctx.cwd, config);
				const count = VERB_PRESETS[match].length;
				const label = match === "none" ? "no verb rotation" : `${match} (${count} verbs)`;
				ctx.ui.notify(`Verb preset: ${label}`, "success");
				return;
			}

			ctx.ui.notify(
				"Usage: /verbs [claude|short|technical|fun|none|add v1,v2,...|replace v1,v2,...]",
				"error",
			);
		},
	});
}
