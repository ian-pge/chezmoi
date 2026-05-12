import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

function getFirstUserMessage(ctx: ExtensionContext): string | undefined {
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type !== "message" || entry.message.role !== "user") continue;

		const content = entry.message.content;
		if (typeof content === "string") return content.trim() || undefined;
		if (Array.isArray(content)) {
			const text = content
				.map((part: unknown) => (typeof part === "object" && part !== null && "text" in part ? String(part.text) : ""))
				.join(" ")
				.trim();
			if (text) return text;
		}
	}
}

function getDisplayName(pi: ExtensionAPI, ctx: ExtensionContext): string {
	return pi.getSessionName() || getFirstUserMessage(ctx) || "New session";
}

export default function (pi: ExtensionAPI) {
	let requestHeaderRender: (() => void) | undefined;

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setHeader((tui, theme) => {
			requestHeaderRender = () => tui.requestRender();

			return {
				render(width: number): string[] {
					return [truncateToWidth(theme.fg("accent", getDisplayName(pi, ctx)), width, theme.fg("dim", "..."))];
				},
				invalidate() {},
				dispose() {
					requestHeaderRender = undefined;
				},
			};
		});
	});

	pi.on("message_end", async () => {
		requestHeaderRender?.();
	});
}
