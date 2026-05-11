/**
 * Custom Header Extension
 *
 * Replaces the built-in pi header with a random Krabby Pokémon sprite.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";

const ANSI_PATTERN = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|_[^\x07]*(?:\x07|\x1b\\))/g;

function stripAnsi(text: string): string {
	return text.replace(ANSI_PATTERN, "");
}

function getKrabbySprite(): { name: string; lines: string[] } {
	try {
		const lines = execFileSync("krabby", ["random", "--no-variant"], {
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

		const name = stripAnsi(lines[0] ?? "").trim();
		return { name, lines };
	} catch {
		return { name: "", lines: [] };
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			const pokemon = getKrabbySprite();

			if (pokemon.name) {
				ctx.ui.setTitle(pokemon.name);
			}

			ctx.ui.setHeader(() => {
				return {
					render(_width: number): string[] {
						return pokemon.lines;
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
