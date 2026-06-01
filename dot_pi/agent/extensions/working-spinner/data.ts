/**
 * working-spinner Data Module
 *
 * Frame presets, verb lists, and completion words
 * for the working spinner extension.
 */

// ─── Types ────────────────────────────────────────────────────────

export type FramePreset = "claude" | "braille" | "pulse" | "barPulse" | "dot" | "star" | "none";
export type VerbPreset = "claude" | "short" | "technical" | "fun" | "none";

export interface FrameConfig {
	frames: string[];
	intervalMs: number;
}

// ─── Frame Presets ────────────────────────────────────────────────

type FramePresets = Record<FramePreset, FrameConfig>;

export const FRAME_PRESETS: FramePresets = {
	/** Claude Code's bespoke 6-frame asterisk/star sequence */
	claude: {
		frames: ["·", "✢", "✳", "✶", "✻", "✽"],
		intervalMs: 100,
	},
	/** Standard Braille dots (pi's default) */
	braille: {
		frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
		intervalMs: 80,
	},
	/** Simple pulse animation */
	pulse: {
		frames: ["·", "•", "●", "•"],
		intervalMs: 120,
	},
	/** Smooth block-height pulse */
	barPulse: {
		frames: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"],
		intervalMs: 70,
	},
	/** Static dot — no animation */
	dot: {
		frames: ["●"],
		intervalMs: 0,
	},
	/** Star / sparkle variants */
	star: {
		frames: ["✧", "★", "✦", "✶", "✹"],
		intervalMs: 100,
	},
	/** Hidden — no indicator shown */
	none: {
		frames: [],
		intervalMs: 0,
	},
};

// ─── Verb Presets ─────────────────────────────────────────────────

type VerbPresets = Record<VerbPreset, string[]>;

/** Full Claude Code verb list (187 verbs, leaked from source) */
const CLAUDE_VERBS: string[] = [
	"Accomplishing",
	"Actioning",
	"Actualizing",
	"Architecting",
	"Baking",
	"Beaming",
	"Beboppin'",
	"Befuddling",
	"Billowing",
	"Blanching",
	"Bloviating",
	"Boogieing",
	"Boondoggling",
	"Booping",
	"Bootstrapping",
	"Brewing",
	"Bunning",
	"Burrowing",
	"Calculating",
	"Canoodling",
	"Caramelizing",
	"Cascading",
	"Catapulting",
	"Cerebrating",
	"Channeling",
	"Channelling",
	"Choreographing",
	"Churning",
	"Clauding",
	"Coalescing",
	"Cogitating",
	"Combobulating",
	"Composing",
	"Computing",
	"Concocting",
	"Considering",
	"Contemplating",
	"Cooking",
	"Crafting",
	"Creating",
	"Crunching",
	"Crystallizing",
	"Cultivating",
	"Deciphering",
	"Deliberating",
	"Determining",
	"Dilly-dallying",
	"Discombobulating",
	"Doing",
	"Doodling",
	"Drizzling",
	"Ebbing",
	"Effecting",
	"Elucidating",
	"Embellishing",
	"Enchanting",
	"Envisioning",
	"Evaporating",
	"Fermenting",
	"Fiddle-faddling",
	"Finagling",
	"Flambéing",
	"Flibbertigibbeting",
	"Flowing",
	"Flummoxing",
	"Fluttering",
	"Forging",
	"Forming",
	"Frolicking",
	"Frosting",
	"Gallivanting",
	"Galloping",
	"Garnishing",
	"Generating",
	"Gesticulating",
	"Germinating",
	"Gitifying",
	"Grooving",
	"Gusting",
	"Harmonizing",
	"Hashing",
	"Hatching",
	"Herding",
	"Honking",
	"Hullaballooing",
	"Hyperspacing",
	"Ideating",
	"Imagining",
	"Improvising",
	"Incubating",
	"Inferring",
	"Infusing",
	"Ionizing",
	"Jitterbugging",
	"Julienning",
	"Kneading",
	"Leavening",
	"Levitating",
	"Lollygagging",
	"Manifesting",
	"Marinating",
	"Meandering",
	"Metamorphosing",
	"Misting",
	"Moonwalking",
	"Moseying",
	"Mulling",
	"Mustering",
	"Musing",
	"Nebulizing",
	"Nesting",
	"Newspapering",
	"Noodling",
	"Nucleating",
	"Orbiting",
	"Orchestrating",
	"Osmosing",
	"Perambulating",
	"Percolating",
	"Perusing",
	"Philosophising",
	"Photosynthesizing",
	"Pollinating",
	"Pondering",
	"Pontificating",
	"Pouncing",
	"Precipitating",
	"Prestidigitating",
	"Processing",
	"Proofing",
	"Propagating",
	"Puttering",
	"Puzzling",
	"Quantumizing",
	"Razzle-dazzling",
	"Razzmatazzing",
	"Recombobulating",
	"Reticulating",
	"Roosting",
	"Ruminating",
	"Sautéing",
	"Scampering",
	"Schlepping",
	"Scurrying",
	"Seasoning",
	"Shenaniganing",
	"Shimmying",
	"Simmering",
	"Skedaddling",
	"Sketching",
	"Slithering",
	"Smooshing",
	"Sock-hopping",
	"Spelunking",
	"Spinning",
	"Sprouting",
	"Stewing",
	"Sublimating",
	"Swirling",
	"Swooping",
	"Symbioting",
	"Synthesizing",
	"Tempering",
	"Thinking",
	"Thundering",
	"Tinkering",
	"Tomfoolering",
	"Topsy-turvying",
	"Transfiguring",
	"Transmuting",
	"Twisting",
	"Undulating",
	"Unfurling",
	"Unravelling",
	"Vibing",
	"Waddling",
	"Wandering",
	"Warping",
	"Whatchamacalliting",
	"Whirlpooling",
	"Whirring",
	"Whisking",
	"Wibbling",
	"Working",
	"Wrangling",
	"Zesting",
	"Zigzagging",
];

const SHORT_VERBS: string[] = [
	"Thinking",
	"Working",
	"Processing",
	"Computing",
	"Analyzing",
	"Generating",
];

const TECHNICAL_VERBS: string[] = [
	"Compiling",
	"Transpiling",
	"Bundling",
	"Linting",
	"Testing",
	"Deploying",
	"Optimizing",
	"Profiling",
	"Validating",
	"Transforming",
	"Executing",
	"Indexing",
];

const FUN_VERBS: string[] = [
	"Beboppin'",
	"Boondoggling",
	"Combobulating",
	"Discombobulating",
	"Flibbertigibbeting",
	"Frolicking",
	"Gallivanting",
	"Gitifying",
	"Hullaballooing",
	"Hyperspacing",
	"Jitterbugging",
	"Moonwalking",
	"Perambulating",
	"Razzle-dazzling",
	"Razzmatazzing",
	"Recombobulating",
	"Reticulating",
	"Shenaniganing",
	"Tomfoolering",
	"Topsy-turvying",
	"Whatchamacalliting",
	"Wibbling",
	"Zigzagging",
];

export const VERB_PRESETS: VerbPresets = {
	claude: CLAUDE_VERBS,
	short: SHORT_VERBS,
	technical: TECHNICAL_VERBS,
	fun: FUN_VERBS,
	none: [],
};

// ─── Completion Verbs (past-tense) ────────────────────────────────

export const COMPLETION_VERBS: string[] = [
	"Done",
	"Complete",
	"Finished",
	"Baked",
	"Brewed",
	"Crunched",
	"Crafted",
	"Forged",
	"Generated",
	"Crystallized",
	"Transmuted",
	"Synthesized",
	"Wrangled",
	"Zigzagged",
];

// ─── Helpers ──────────────────────────────────────────────────────

/** Pick a random element from an array */
export function randomItem<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Pretty-print a frame list for display */
export function formatFrames(frames: string[]): string {
	if (frames.length === 0) return "(none)";
	if (frames.length === 1) return frames[0]!;
	return frames.join(" ");
}

/** Get frame preset by key, fallback to braille */
export function getFrameConfig(key: string): FrameConfig {
	const preset = FRAME_PRESETS[key as FramePreset];
	return preset ?? FRAME_PRESETS.braille;
}

/** Get verb list by key, fallback to claude */
export function getVerbList(key: string): string[] {
	const list = VERB_PRESETS[key as VerbPreset];
	return list ?? VERB_PRESETS.claude;
}
