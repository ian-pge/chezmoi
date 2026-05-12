import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const ELAPSED_WIDGET_KEY = "elapsed-working-indicator:last-answer";

function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) return `${hours}h${minutes.toString().padStart(2, "0")}m`;
	if (minutes > 0) return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
	return `${seconds}s`;
}

function formatElapsedForDisplay(ui: ExtensionContext["ui"], elapsedMs: number): string {
	return ui.theme.fg("warning", formatElapsed(elapsedMs));
}

function setElapsedWidget(ui: ExtensionContext["ui"], elapsedMs: number): void {
	ui.setWidget(ELAPSED_WIDGET_KEY, [formatElapsedForDisplay(ui, elapsedMs)], {
		placement: "aboveEditor",
	});
}

export default function (pi: ExtensionAPI) {
	let activeAnswerStart: number | null = null;
	let lastAnswerElapsedMs = 0;
	let interval: ReturnType<typeof setInterval> | undefined;
	let latestUi: ExtensionContext["ui"] | undefined;

	const render = () => {
		if (!latestUi || activeAnswerStart === null) return;
		setElapsedWidget(latestUi, Date.now() - activeAnswerStart);
	};

	const stopTimer = () => {
		if (interval) {
			clearInterval(interval);
			interval = undefined;
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		latestUi = ctx.ui;
		ctx.ui.setWidget(ELAPSED_WIDGET_KEY, undefined);
	});

	pi.on("agent_start", async (_event, ctx) => {
		latestUi = ctx.ui;
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
			setElapsedWidget(latestUi, lastAnswerElapsedMs);
		}
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
	});
}
