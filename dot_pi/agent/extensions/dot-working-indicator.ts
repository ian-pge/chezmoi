import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const RESET = "\x1b[0m";
const PATCHED_KEY = "__dotWorkingIndicatorPatched";

function firstForegroundColor(text: string | undefined): string | undefined {
	if (!text) return undefined;

	return (
		text.match(/\x1b\[[0-9;]*38;2;\d+;\d+;\d+m/)?.[0] ??
		text.match(/\x1b\[[0-9;]*38;5;\d+m/)?.[0] ??
		text.match(/\x1b\[[0-9;]*(?:3[0-7]|9[0-7])m/)?.[0]
	);
}

function setDot(ui: ExtensionContext["ui"], color?: string): void {
	ui.setWorkingIndicator({
		frames: [color ? `${color}●${RESET}` : ui.theme.fg("accent", "●")],
	});
}

function patchWorkingMessage(ctx: ExtensionContext): void {
	const ui = ctx.ui as ExtensionContext["ui"] & Record<string, unknown>;
	if (ui[PATCHED_KEY]) return;
	ui[PATCHED_KEY] = true;

	const originalSetWorkingMessage = ui.setWorkingMessage.bind(ui);

	ui.setWorkingMessage = (message?: string) => {
		setDot(ui, firstForegroundColor(message));
		originalSetWorkingMessage(message);
	};
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		patchWorkingMessage(ctx);
		setDot(ctx.ui);
	});

	pi.on("agent_start", async (_event, ctx) => {
		patchWorkingMessage(ctx);
		setDot(ctx.ui);
	});
}
