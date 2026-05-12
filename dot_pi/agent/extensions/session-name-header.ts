import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import { execFileSync } from "node:child_process";

function getPiVersion(): string {
	try {
		return execFileSync("pi", ["--version"], { encoding: "utf8", timeout: 1000 }).trim();
	} catch {
		return "unknown";
	}
}

export default function (pi: ExtensionAPI) {
	const version = getPiVersion();

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setHeader((_tui, theme) => {
			return {
				render(width: number): string[] {
					return [truncateToWidth(theme.fg("accent", `pi ${version}`), width, theme.fg("dim", "..."))];
				},
				invalidate() {},
			};
		});
	});
}
