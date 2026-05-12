import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setHeader((_tui, theme) => {
			return {
				render(_width: number): string[] {
					const sessionName = ctx.sessionManager.getSessionName();
					return sessionName ? [theme.fg("accent", sessionName)] : [];
				},
				invalidate() {},
			};
		});
	});
}
