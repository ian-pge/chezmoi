import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const RESET = "\x1b[0m";
const CATPPUCCIN_MACCHIATO_YELLOW = "\x1b[38;2;238;212;159m";
const ELAPSED_WIDGET_KEY = "elapsed-working-indicator:last-answer";
const PATCHED_KEY = "__elapsedWorkingIndicatorPatched";

function firstForegroundColor(text: string | undefined): string | undefined {
	if (!text) return undefined;

	return (
		text.match(/\x1b\[[0-9;]*38;2;\d+;\d+;\d+m/)?.[0] ??
		text.match(/\x1b\[[0-9;]*38;5;\d+m/)?.[0] ??
		text.match(/\x1b\[[0-9;]*(?:3[0-7]|9[0-7])m/)?.[0]
	);
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

function setElapsedIndicator(ui: ExtensionContext["ui"], elapsedMs: number, color?: string): void {
	const text = formatElapsed(elapsedMs);
	ui.setWorkingIndicator({
		frames: [color ? `${color}${text}${RESET}` : ui.theme.fg("accent", text)],
	});
}

function setElapsedWidget(ui: ExtensionContext["ui"], elapsedMs: number): void {
	ui.setWidget(ELAPSED_WIDGET_KEY, [`${CATPPUCCIN_MACCHIATO_YELLOW}${formatElapsed(elapsedMs)}${RESET}`], {
		placement: "aboveEditor",
	});
}

export default function (pi: ExtensionAPI) {
	let activeAnswerStart: number | null = null;
	let lastAnswerElapsedMs = 0;
	let interval: ReturnType<typeof setInterval> | undefined;
	let latestUi: ExtensionContext["ui"] | undefined;
	let latestColor: string | undefined;

	const render = () => {
		if (!latestUi || activeAnswerStart === null) return;
		setElapsedIndicator(latestUi, Date.now() - activeAnswerStart, latestColor);
	};

	const stopTimer = () => {
		if (interval) {
			clearInterval(interval);
			interval = undefined;
		}
	};

	function patchWorkingMessage(ctx: ExtensionContext): void {
		const ui = ctx.ui as ExtensionContext["ui"] & Record<string, unknown>;
		if (ui[PATCHED_KEY]) return;
		ui[PATCHED_KEY] = true;

		const originalSetWorkingMessage = ui.setWorkingMessage.bind(ui);

		ui.setWorkingMessage = (message?: string) => {
			latestColor = firstForegroundColor(message) ?? latestColor;
			originalSetWorkingMessage(message);
			render();
		};
	}

	pi.on("session_start", async (_event, ctx) => {
		latestUi = ctx.ui;
		patchWorkingMessage(ctx);
		ctx.ui.setWidget(ELAPSED_WIDGET_KEY, undefined);
		ctx.ui.setWorkingIndicator();
	});

	pi.on("agent_start", async (_event, ctx) => {
		latestUi = ctx.ui;
		patchWorkingMessage(ctx);
		ctx.ui.setWidget(ELAPSED_WIDGET_KEY, undefined);
		activeAnswerStart = Date.now();
		lastAnswerElapsedMs = 0;
		render();

		stopTimer();
		interval = setInterval(render, 1000);
	});

	pi.on("agent_end", async () => {
		if (activeAnswerStart !== null) {
			lastAnswerElapsedMs = Date.now() - activeAnswerStart;
			activeAnswerStart = null;
		}
		stopTimer();
		if (latestUi) {
			latestUi.setWorkingIndicator();
			setElapsedWidget(latestUi, lastAnswerElapsedMs);
		}
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
	});
}
