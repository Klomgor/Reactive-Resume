export type ExpectedToken = {
	value: string;
	group: string;
};

export type EvaluationCorpus = {
	name: string;
	tokens: readonly ExpectedToken[];
};

export type ExtractedExport = {
	/** Paragraphs/lines in the extractor's returned order. */
	paragraphs: readonly string[];
	links: readonly string[];
};

export type ExportMetrics = {
	recall: { numerator: number; denominator: number; value: number };
	order: { numerator: number; denominator: number; value: number };
	duplicates: { expected: number; observed: number; extra: number };
	grouping: { numerator: number; denominator: number; value: number };
	missingTokens: readonly string[];
	outOfOrderPairs: readonly (readonly [string, string])[];
	observedTokens: number;
};

/**
 * Tokenization used by this evaluation only. It is deliberately transparent and locale-neutral:
 * Unicode letters/numbers stay intact, punctuation is a separator, and matching is case-folded.
 * This is a corpus metric, not a claim about any vendor parser.
 */
export function tokenize(value: string): string[] {
	return (
		value
			.normalize("NFC")
			.match(/[\p{L}\p{N}]+/gu)
			?.map((token) => token.toLocaleLowerCase("en-US")) ?? []
	);
}

const metric = (numerator: number, denominator: number) => ({
	numerator,
	denominator,
	value: denominator === 0 ? 1 : numerator / denominator,
});

/**
 * Computes raw extraction measurements from corpus tokens and extractor paragraphs.
 *
 * Recall uses distinct expected tokens. Duplicate accounting separately reports all matching
 * occurrences, so dropping a token cannot be hidden by duplicate output. Order and grouping use
 * the first occurrence of each distinct expected token, keeping those measures interpretable when
 * an export repeats a heading or bullet.
 */
export function evaluateExport(corpus: EvaluationCorpus, extracted: ExtractedExport): ExportMetrics {
	const expected = corpus.tokens.flatMap((entry) =>
		tokenize(entry.value).map((value) => ({ value, group: entry.group })),
	);
	const expectedByValue = new Map<string, { group: string; index: number }>();
	for (const [index, token] of expected.entries()) {
		if (!expectedByValue.has(token.value)) expectedByValue.set(token.value, { group: token.group, index });
	}

	const observedByParagraph = extracted.paragraphs.map(tokenize);
	const observed = observedByParagraph.flat();
	const expectedValues = [...expectedByValue.keys()];
	const observedPositions = new Map<string, number>();
	for (const [index, token] of observed.entries()) {
		if (!observedPositions.has(token)) observedPositions.set(token, index);
	}

	const recoveredDistinct = expectedValues.filter((value) => observedPositions.has(value)).length;
	const expectedTokenPairs = expectedValues.flatMap((value, index) => {
		const next = expectedValues[index + 1];
		return next ? ([[value, next]] as const) : [];
	});
	const outOfOrderPairs = expectedTokenPairs.filter(([left, right]) => {
		const leftPosition = observedPositions.get(left);
		const rightPosition = observedPositions.get(right);
		return leftPosition === undefined || rightPosition === undefined || leftPosition >= rightPosition;
	});

	const observedParagraphPositions = new Map<string, number>();
	for (const [paragraphIndex, paragraphTokens] of observedByParagraph.entries()) {
		for (const token of paragraphTokens) {
			if (!observedParagraphPositions.has(token)) observedParagraphPositions.set(token, paragraphIndex);
		}
	}
	const groupedPairs = expectedTokenPairs.filter(([left, right]) => {
		const leftEntry = expectedByValue.get(left);
		const rightEntry = expectedByValue.get(right);
		const leftParagraph = observedParagraphPositions.get(left);
		const rightParagraph = observedParagraphPositions.get(right);
		return (
			leftEntry?.group === rightEntry?.group &&
			leftParagraph !== undefined &&
			rightParagraph !== undefined &&
			leftParagraph === rightParagraph
		);
	}).length;

	const expectedValuesSet = new Set(expectedValues);
	const observedExpectedOccurrences = observed.filter((token) => expectedValuesSet.has(token)).length;

	return {
		recall: metric(recoveredDistinct, expectedValues.length),
		order: metric(expectedTokenPairs.length - outOfOrderPairs.length, expectedTokenPairs.length),
		duplicates: {
			expected: expected.length,
			observed: observedExpectedOccurrences,
			extra: Math.max(0, observedExpectedOccurrences - expected.length),
		},
		grouping: metric(groupedPairs, expectedTokenPairs.length),
		missingTokens: expectedValues.filter((value) => !observedPositions.has(value)),
		outOfOrderPairs,
		observedTokens: observed.length,
	};
}
