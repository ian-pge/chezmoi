/**
 * Custom Header Extension
 *
 * Replaces the built-in pi header with a random Krabby Pokémon sprite.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";

function getKrabbySprite(): string[] {
	try {
		return execFileSync("krabby", ["random", "--no-variant"], {
			encoding: "utf8",
			timeout: 1500,
			env: {
				...process.env,
				FORCE_COLOR: "1",
				PATH: `${process.env.HOME}/.cargo/bin:${process.env.PATH || ""}`,
			},
		})
			.trimEnd()
			.split("\n");
	} catch {
		return [];
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			const krabbyLines = getKrabbySprite();

			ctx.ui.setHeader(() => {
				return {
					render(_width: number): string[] {
						return krabbyLines;
					},
					invalidate() {},
				};
			});
		}
	});

	pi.registerCommand("builtin-header", {
		description: "Restore built-in header with keybinding hints",
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("Built-in header restored", "info");
		},
	});
}
