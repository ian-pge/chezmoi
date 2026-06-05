import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CATPPUCCIN_MACCHIATO_PINK = "#f5bde6";
const CATPPUCCIN_MACCHIATO_BLUE = "#8aadf4";
const CATPPUCCIN_MACCHIATO_GREEN = "#a6da95";
const CATPPUCCIN_MACCHIATO_RED = "#ed8796";
const WIDGET_KEY = "answer-summary:final";
const MAX_FILE_ROWS = 8;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;

type FileSnapshot =
	| { kind: "text"; content: string | null }
	| { kind: "skipped"; reason: string };

type FileStats = {
	path: string;
	name: string;
	status: "added" | "deleted" | "modified";
	added: number;
	removed: number;
};

const beforeByPath = new Map<string, FileSnapshot>();
const touchedPaths = new Set<string>();
let activeAnswerStart: number | null = null;

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16),
	];
}

function colorHex(hex: string, text: string): string {
	const [r, g, b] = hexToRgb(hex);
	return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) return `${hours}h${minutes.toString().padStart(2, "0")}m`;
	if (minutes > 0) return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
	return `${seconds}s`;
}

function readSnapshot(path: string): FileSnapshot {
	try {
		if (!existsSync(path)) return { kind: "text", content: null };
		const stat = statSync(path);
		if (!stat.isFile()) return { kind: "skipped", reason: "not a file" };
		if (stat.size > MAX_TEXT_BYTES) return { kind: "skipped", reason: "large file" };
		return { kind: "text", content: readFileSync(path, "utf8") };
	} catch (error) {
		return { kind: "skipped", reason: error instanceof Error ? error.message : String(error) };
	}
}

function splitLines(content: string): string[] {
	if (content.length === 0) return [];
	const lines = content.split("\n");
	if (lines[lines.length - 1] === "") lines.pop();
	return lines;
}

function shortestInsertDeleteScriptLength(beforeLines: string[], afterLines: string[]): number {
	let beforeStart = 0;
	let afterStart = 0;
	let beforeEnd = beforeLines.length;
	let afterEnd = afterLines.length;

	while (beforeStart < beforeEnd && afterStart < afterEnd && beforeLines[beforeStart] === afterLines[afterStart]) {
		beforeStart++;
		afterStart++;
	}

	while (
		beforeStart < beforeEnd &&
		afterStart < afterEnd &&
		beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]
	) {
		beforeEnd--;
		afterEnd--;
	}

	const oldLines = beforeLines.slice(beforeStart, beforeEnd);
	const newLines = afterLines.slice(afterStart, afterEnd);
	const oldCount = oldLines.length;
	const newCount = newLines.length;

	if (oldCount === 0) return newCount;
	if (newCount === 0) return oldCount;

	const max = oldCount + newCount;
	const offset = max + 1;
	const furthest = new Int32Array(max * 2 + 3);
	furthest.fill(-1);
	furthest[offset + 1] = 0;

	for (let distance = 0; distance <= max; distance++) {
		for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
			const index = offset + diagonal;
			const goDown = diagonal === -distance || (diagonal !== distance && furthest[index - 1] < furthest[index + 1]);
			let x = goDown ? furthest[index + 1] : furthest[index - 1] + 1;
			let y = x - diagonal;

			while (x < oldCount && y < newCount && oldLines[x] === newLines[y]) {
				x++;
				y++;
			}

			furthest[index] = x;
			if (x >= oldCount && y >= newCount) return distance;
		}
	}

	return max;
}

function diffLineStats(before: string | null, after: string | null): { added: number; removed: number } {
	if (before === after) return { added: 0, removed: 0 };

	const beforeLines = splitLines(before ?? "");
	const afterLines = splitLines(after ?? "");
	const distance = shortestInsertDeleteScriptLength(beforeLines, afterLines);

	return {
		added: Math.max(0, Math.round((distance - beforeLines.length + afterLines.length) / 2)),
		removed: Math.max(0, Math.round((distance + beforeLines.length - afterLines.length) / 2)),
	};
}

function toolPath(input: unknown): string | null {
	if (!input || typeof input !== "object") return null;
	const value = (input as { path?: unknown; file_path?: unknown }).path ??
		(input as { path?: unknown; file_path?: unknown }).file_path;
	return typeof value === "string" && value.length > 0 ? value : null;
}

function absoluteToolPath(ctx: ExtensionContext, input: unknown): string | null {
	const path = toolPath(input);
	return path === null ? null : resolve(ctx.cwd, path);
}

function displayPath(path: string, _cwd: string): string {
	return basename(path) || path;
}

function pathParts(path: string, cwd: string): string[] {
	const rel = relative(cwd, path);
	const displayPath = rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : path;
	return displayPath.split(/[\\/]+/).filter(Boolean);
}

function disambiguateDuplicateNames(rows: FileStats[], cwd: string) {
	const byName = new Map<string, FileStats[]>();
	for (const row of rows) {
		const group = byName.get(row.name) ?? [];
		group.push(row);
		byName.set(row.name, group);
	}

	for (const group of byName.values()) {
		if (group.length <= 1) continue;

		const partsByPath = new Map(group.map((row) => [row.path, pathParts(row.path, cwd)]));
		const maxDepth = Math.max(...Array.from(partsByPath.values(), (parts) => parts.length));

		for (let depth = 2; depth <= maxDepth; depth++) {
			const names = group.map((row) => (partsByPath.get(row.path) ?? [row.name]).slice(-depth).join("/"));
			if (new Set(names).size !== group.length) continue;

			for (let i = 0; i < group.length; i++) group[i].name = names[i];
			break;
		}
	}
}

function rememberBefore(path: string) {
	if (!beforeByPath.has(path)) beforeByPath.set(path, readSnapshot(path));
}

function clearSummary(ctx: ExtensionContext) {
	ctx.ui.setWidget(WIDGET_KEY, undefined);
}

function collectFileStats(ctx: ExtensionContext): FileStats[] {
	const rows: FileStats[] = [];

	for (const path of touchedPaths) {
		const before = beforeByPath.get(path);
		const after = readSnapshot(path);
		if (!before || before.kind !== "text" || after.kind !== "text") continue;

		const { added, removed } = diffLineStats(before.content, after.content);
		if (added === 0 && removed === 0) continue;

		const status = before.content === null ? "added" : after.content === null ? "deleted" : "modified";
		rows.push({ path, name: displayPath(path, ctx.cwd), status, added, removed });
	}

	disambiguateDuplicateNames(rows, ctx.cwd);

	const statusOrder = { modified: 0, added: 1, deleted: 2 } as const;
	rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name));
	return rows;
}

function renderSummary(ctx: ExtensionContext, elapsedMs: number): string[] {
	const rows = collectFileStats(ctx);
	const elapsed = colorHex(CATPPUCCIN_MACCHIATO_PINK, formatElapsed(elapsedMs));

	if (rows.length === 0) return [elapsed];

	const totalAdded = rows.reduce((sum, row) => sum + row.added, 0);
	const totalRemoved = rows.reduce((sum, row) => sum + row.removed, 0);
	const firstLine = [
		elapsed,
		ctx.ui.theme.fg("dim", `${rows.length} ${rows.length === 1 ? "file" : "files"}`),
		ctx.ui.theme.fg("success", `+${totalAdded}`),
		ctx.ui.theme.fg("error", `-${totalRemoved}`),
	].join(" ");

	const detailLines = rows.slice(0, MAX_FILE_ROWS).map((row) => {
		const styledName = row.status === "added"
			? colorHex(CATPPUCCIN_MACCHIATO_GREEN, row.name)
			: row.status === "deleted"
				? colorHex(CATPPUCCIN_MACCHIATO_RED, row.name)
				: colorHex(CATPPUCCIN_MACCHIATO_BLUE, row.name);

		if (row.status === "added") return `${styledName} ${ctx.ui.theme.fg("success", `+${row.added}`)}`;
		if (row.status === "deleted") return `${styledName} ${ctx.ui.theme.fg("error", `-${row.removed}`)}`;
		return `${styledName} ${ctx.ui.theme.fg("success", `+${row.added}`)} ${ctx.ui.theme.fg("error", `-${row.removed}`)}`;
	});

	if (rows.length > MAX_FILE_ROWS) {
		detailLines.push(ctx.ui.theme.fg("dim", `… ${rows.length - MAX_FILE_ROWS} more`));
	}

	return [firstLine, ...detailLines];
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		clearSummary(ctx);
	});

	pi.on("agent_start", async (_event, ctx) => {
		activeAnswerStart = Date.now();
		beforeByPath.clear();
		touchedPaths.clear();
		clearSummary(ctx);
	});

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "edit" && event.toolName !== "write") return;
		const path = absoluteToolPath(ctx, event.input);
		if (path !== null) rememberBefore(path);
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.isError) return;
		if (event.toolName !== "edit" && event.toolName !== "write") return;

		const path = absoluteToolPath(ctx, event.input);
		if (path === null) return;

		rememberBefore(path);
		touchedPaths.add(path);
	});

	pi.on("agent_end", async (_event, ctx) => {
		const elapsedMs = activeAnswerStart === null ? 0 : Date.now() - activeAnswerStart;
		activeAnswerStart = null;
		ctx.ui.setWidget(WIDGET_KEY, renderSummary(ctx, elapsedMs), { placement: "aboveEditor" });
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		activeAnswerStart = null;
		beforeByPath.clear();
		touchedPaths.clear();
		clearSummary(ctx);
	});
}
