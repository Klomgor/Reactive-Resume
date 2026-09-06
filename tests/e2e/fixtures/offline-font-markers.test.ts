import { describe, expect, it } from "vitest";
import { classifyRasterInk, locatePdfMarkerBoxes } from "./offline-font-markers";

const marker = { name: "cjk", marker: "简体中文" } as const;

const item = (str: string, x = 10, y = 100, width = str.length * 5) => ({
	str,
	x,
	y,
	width,
	height: 12,
});

describe("locatePdfMarkerBoxes", () => {
	it("rejects duplicate marker sources instead of selecting an arbitrary crop", () => {
		const result = locatePdfMarkerBoxes([item(marker.marker), item(marker.marker, 10, 70)], [marker], 200);

		expect(result).toEqual([{ ...marker, box: null }]);
	});

	it("unions text items when one marker is split across PDF text items", () => {
		const result = locatePdfMarkerBoxes([item("简体"), item("中文", 20)], [marker], 200);

		expect(result[0]?.box).toEqual({ x: 10, y: 88, width: 20, height: 12 });
	});

	it("rejects text-item neighbors that could contaminate marker-local raster evidence", () => {
		const result = locatePdfMarkerBoxes([item(`prefix${marker.marker}suffix`)], [marker], 200);

		expect(result).toEqual([{ ...marker, box: null }]);
	});
});

describe("classifyRasterInk", () => {
	it("does not treat a blank crop as visible", () => {
		expect(classifyRasterInk({ inkPixels: 0, interiorInk: 0, trimmedWidth: 0, trimmedHeight: 0 })).toBe("blank");
	});

	it("does not treat tofu-like outline as visible", () => {
		expect(classifyRasterInk({ inkPixels: 100, interiorInk: 0, trimmedWidth: 20, trimmedHeight: 20 })).toBe(
			"tofu-like",
		);
	});
});
