import { describe, expect, it } from "vitest";
import { evaluateExport } from "./metrics";

const corpus = {
	name: "synthetic",
	tokens: [
		{ value: "Alpha", group: "experience" },
		{ value: "Bravo", group: "experience" },
		{ value: "Charlie", group: "education" },
	] as const,
};

describe("evaluateExport", () => {
	it("counts distinct recall, order, duplicate, and grouping losses from raw tokens", () => {
		const result = evaluateExport(corpus, {
			paragraphs: ["Alpha Bravo Bravo", "Charlie"],
			links: [],
		});

		expect(result.recall).toEqual({ numerator: 3, denominator: 3, value: 1 });
		expect(result.order).toEqual({ numerator: 2, denominator: 2, value: 1 });
		expect(result.duplicates).toEqual({ expected: 3, observed: 4, extra: 1 });
		expect(result.missingTokens).toEqual([]);
		expect(result.outOfOrderPairs).toEqual([]);
		expect(result.grouping).toEqual({ numerator: 1, denominator: 2, value: 0.5 });
	});

	it("detects a dropped token and an inverted pair", () => {
		const result = evaluateExport(corpus, {
			paragraphs: ["Bravo", "Alpha"],
			links: [],
		});

		expect(result.recall).toEqual({ numerator: 2, denominator: 3, value: 2 / 3 });
		expect(result.order).toEqual({ numerator: 0, denominator: 2, value: 0 });
		expect(result.duplicates).toEqual({ expected: 3, observed: 2, extra: 0 });
		expect(result.missingTokens).toEqual(["charlie"]);
		expect(result.outOfOrderPairs).toEqual([
			["alpha", "bravo"],
			["bravo", "charlie"],
		]);
	});
});
