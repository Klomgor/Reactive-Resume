import type { Page, TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Pool } from "pg";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { createSampleResumeFromDashboard, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

type CapturedPdfWindow = Window & { resumePdfBytes?: number[] };

type GeometryScenario = {
	format: "a4" | "letter" | "free-form";
	marginY: number;
	overflow: boolean;
};

type PdfPageGeometry = {
	mediaBox: { height: number; width: number };
	inkBounds: { bottomY: number; topY: number } | null;
	sentinels: Record<string, { bottomY: number; topY: number }>;
	text: string;
};

type PdfGeometry = {
	pages: PdfPageGeometry[];
	pageCount: number;
};

type PreviewPageGeometry = {
	canvas: { cssHeight: number; cssWidth: number; height: number; width: number };
	canvasRect: { height: number; width: number; x: number; y: number };
	wrapper: { clientHeight: number; clientWidth: number; height: number; width: number; x: number; y: number };
};

type PreviewGeometry = {
	devicePixelRatio: number;
	pages: PreviewPageGeometry[];
	viewportClip: {
		clientHeight: number;
		clientWidth: number;
		height: number;
		scrollHeight: number;
		scrollWidth: number;
		width: number;
		x: number;
		y: number;
	};
	viewport: { height: number; width: number };
};

const FORMATS: GeometryScenario["format"][] = ["a4", "letter", "free-form"];
const MARGINS = [defaultResumeData.metadata.page.marginY, 15];
const SCENARIOS: GeometryScenario[] = FORMATS.flatMap((format) =>
	MARGINS.flatMap((marginY) => [
		{ format, marginY, overflow: false },
		{ format, marginY, overflow: true },
	]),
);

const requirePdf = createRequire(`${process.cwd()}/packages/pdf/package.json`);
const requireWeb = createRequire(`${process.cwd()}/apps/web/package.json`);
const { createCanvas } = requirePdf("@napi-rs/canvas") as {
	createCanvas: (
		width: number,
		height: number,
	) => {
		getContext: (type: "2d") => {
			getImageData: (x: number, y: number, width: number, height: number) => { data: Uint8ClampedArray };
		};
	};
};

function dedicatedDatabaseUrl() {
	const value = process.env.DATABASE_URL;
	if (!value) throw new Error("DATABASE_URL is required for preview/export geometry E2E.");

	const url = new URL(value);
	if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "55432") {
		throw new Error(
			"Refusing preview/export geometry E2E: DATABASE_URL must point at disposable PostgreSQL port 55432.",
		);
	}

	return value;
}

function scenarioName(scenario: GeometryScenario) {
	return `GEOMETRY_${scenario.format.toUpperCase()}_M${scenario.marginY}_${scenario.overflow ? "OVERFLOW" : "FIT"}`;
}

function createFixture(scenario: GeometryScenario) {
	const data = structuredClone(defaultResumeData);
	const name = scenarioName(scenario);
	const paragraphs = scenario.overflow ? 40 : 4;

	data.picture.hidden = true;
	data.picture.url = "";
	data.basics.name = name;
	data.basics.headline = "Synthetic Helvetica geometry fixture";
	data.basics.email = "";
	data.basics.phone = "";
	data.basics.location = "";
	data.basics.website = { url: "", label: "" };
	data.basics.customFields = [];
	data.summary.title = "Geometry";
	data.summary.content = [
		"<p>TOP_SENTINEL</p>",
		...Array.from(
			{ length: paragraphs },
			(_, index) => `<p>Geometry line ${index + 1}: deterministic Helvetica content for page measurements.</p>`,
		),
		"<p>BOTTOM_SENTINEL</p>",
	].join("");
	data.sections = structuredClone(defaultResumeData.sections);
	data.metadata.template = "rhyhorn";
	data.metadata.layout.pages = [{ fullWidth: true, main: ["summary"], sidebar: [] }];
	data.metadata.page = {
		...data.metadata.page,
		format: scenario.format,
		marginY: scenario.marginY,
	};
	data.metadata.typography.body.fontFamily = "Helvetica";
	data.metadata.typography.heading.fontFamily = "Helvetica";
	data.metadata.notes = `preview-export-geometry:${name}`;

	return data;
}

async function updateFixture(resumeId: string, data: ReturnType<typeof createFixture>) {
	const pool = new Pool({ connectionString: dedicatedDatabaseUrl() });
	try {
		await pool.query('update "resume" set data = $2, updated_at = now() where id = $1', [resumeId, data]);
		const result = await pool.query<{ notes: string }>(
			"select data -> 'metadata' ->> 'notes' as notes from \"resume\" where id = $1",
			[resumeId],
		);
		if (result.rows[0]?.notes !== data.metadata.notes) throw new Error("Synthetic geometry fixture did not persist.");
	} finally {
		await pool.end();
	}
}

async function installPreviewCapture(page: Page) {
	await page.addInitScript(() => {
		(window as CapturedPdfWindow).resumePdfBytes = undefined;
		const originalArrayBuffer = Blob.prototype.arrayBuffer;
		Blob.prototype.arrayBuffer = async function () {
			const buffer = await originalArrayBuffer.call(this);
			const bytes = new Uint8Array(buffer);
			if (String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") {
				(window as CapturedPdfWindow).resumePdfBytes = Array.from(bytes);
			}
			return buffer;
		};
	});

	await page.route("**/__pdf_reference/*", async (route) => {
		const worker = new URL(route.request().url()).pathname.endsWith("worker.mjs");
		await route.fulfill({
			contentType: "text/javascript",
			path: requireWeb.resolve(`pdfjs-dist/legacy/build/${worker ? "pdf.worker.mjs" : "pdf.mjs"}`),
		});
	});
}

async function inspectPdf(bytes: Uint8Array): Promise<PdfGeometry> {
	const loading = getDocument({ data: bytes.slice(), useSystemFonts: true });
	try {
		const document = await loading.promise;
		const pages: PdfPageGeometry[] = [];
		for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
			const page = await document.getPage(pageNumber);
			const viewport = page.getViewport({ scale: 1 });
			const content = await page.getTextContent();
			const sentinels: PdfPageGeometry["sentinels"] = {};
			for (const item of content.items) {
				if (!("str" in item) || !(item.str.includes("TOP_SENTINEL") || item.str.includes("BOTTOM_SENTINEL"))) continue;
				const topY = viewport.height - item.transform[5] - item.height;
				const bottomY = viewport.height - item.transform[5];
				if (item.str.includes("TOP_SENTINEL")) sentinels.TOP_SENTINEL = { bottomY, topY };
				if (item.str.includes("BOTTOM_SENTINEL")) sentinels.BOTTOM_SENTINEL = { bottomY, topY };
			}

			const width = Math.ceil(viewport.width);
			const height = Math.ceil(viewport.height);
			const canvas = createCanvas(width, height);
			const context = canvas.getContext("2d");
			await page.render({
				canvas: canvas as unknown as HTMLCanvasElement,
				canvasContext: context as unknown as CanvasRenderingContext2D,
				viewport,
				background: "white",
			}).promise;
			const pixels = context.getImageData(0, 0, width, height).data;
			let topY = height;
			let bottomY = -1;
			for (let y = 0; y < height; y += 1) {
				for (let x = 0; x < width; x += 1) {
					const offset = (y * width + x) * 4;
					if (
						(pixels[offset] ?? 255) >= 245 &&
						(pixels[offset + 1] ?? 255) >= 245 &&
						(pixels[offset + 2] ?? 255) >= 245
					) {
						continue;
					}
					topY = Math.min(topY, y);
					bottomY = Math.max(bottomY, y);
				}
			}

			pages.push({
				mediaBox: { width: viewport.width, height: viewport.height },
				inkBounds: bottomY >= 0 ? { bottomY, topY } : null,
				sentinels,
				text: content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" "),
			});
			page.cleanup();
		}
		return { pages, pageCount: document.numPages };
	} finally {
		await loading.destroy();
	}
}

async function capturePreviewBytes(page: Page, expectedText: string) {
	let bytes: Uint8Array | undefined;
	let geometry: PdfGeometry | undefined;
	for (let attempt = 0; attempt < 80; attempt += 1) {
		const captured = await page.evaluate(() => (window as CapturedPdfWindow).resumePdfBytes);
		if (captured) {
			const candidate = Uint8Array.from(captured);
			const candidateGeometry = await inspectPdf(candidate);
			if (candidateGeometry.pages.some((entry) => entry.text.includes(expectedText))) {
				bytes = candidate;
				geometry = candidateGeometry;
				break;
			}
		}
		await page.waitForTimeout(250);
	}
	if (!bytes || !geometry) throw new Error(`Active preview PDF did not settle on ${expectedText}.`);
	return { bytes, geometry };
}

function capturePreviewGeometry(page: Page): Promise<PreviewGeometry> {
	return page.evaluate(() => {
		const active = document.querySelector<HTMLElement>('[aria-hidden="false"][data-resume-preview-template="rhyhorn"]');
		if (!active) throw new Error("Missing active Rhyhorn preview layer.");
		let viewportElement: HTMLElement | null = active;
		while (
			viewportElement &&
			(viewportElement.clientWidth < window.innerWidth || viewportElement.clientHeight < window.innerHeight)
		) {
			viewportElement = viewportElement.parentElement;
		}
		if (!viewportElement) throw new Error("Missing preview viewport clip.");
		const viewportRect = viewportElement.getBoundingClientRect();
		const pages = [...active.querySelectorAll<HTMLCanvasElement>('canvas[aria-label^="Resume page"]')].map((canvas) => {
			const wrapper = canvas.parentElement;
			if (!wrapper) throw new Error("Missing preview canvas wrapper.");
			const canvasRect = canvas.getBoundingClientRect();
			const wrapperRect = wrapper.getBoundingClientRect();
			return {
				canvas: {
					cssHeight: Number.parseFloat(canvas.style.height),
					cssWidth: Number.parseFloat(canvas.style.width),
					height: canvas.height,
					width: canvas.width,
				},
				canvasRect: { height: canvasRect.height, width: canvasRect.width, x: canvasRect.x, y: canvasRect.y },
				wrapper: {
					clientHeight: wrapper.clientHeight,
					clientWidth: wrapper.clientWidth,
					height: wrapperRect.height,
					width: wrapperRect.width,
					x: wrapperRect.x,
					y: wrapperRect.y,
				},
			};
		});
		if (pages.length === 0) throw new Error("Missing active preview canvases.");
		return {
			devicePixelRatio: window.devicePixelRatio,
			pages,
			viewportClip: {
				clientHeight: viewportElement.clientHeight,
				clientWidth: viewportElement.clientWidth,
				height: viewportRect.height,
				scrollHeight: viewportElement.scrollHeight,
				scrollWidth: viewportElement.scrollWidth,
				width: viewportRect.width,
				x: viewportRect.x,
				y: viewportRect.y,
			},
			viewport: { height: window.innerHeight, width: window.innerWidth },
		};
	});
}

function comparePreviewToPdf(page: Page, bytes: Uint8Array) {
	return page.evaluate(async (serializedBytes) => {
		const active = document.querySelector<HTMLElement>('[aria-hidden="false"][data-resume-preview-template="rhyhorn"]');
		const canvases = [...(active?.querySelectorAll<HTMLCanvasElement>('canvas[aria-label^="Resume page"]') ?? [])];
		if (canvases.length === 0) throw new Error("Missing active preview canvases for pixel comparison.");
		const moduleUrl = `${location.origin}/__pdf_reference/pdf.mjs`;
		const pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") = await import(moduleUrl);
		pdfjs.GlobalWorkerOptions.workerSrc = `${location.origin}/__pdf_reference/worker.mjs`;
		const task = pdfjs.getDocument({ data: Uint8Array.from(serializedBytes) });
		try {
			const pdfDocument = await task.promise;
			if (pdfDocument.numPages !== canvases.length) throw new Error("Preview and downloaded PDF page counts differ.");
			const pages = [];
			for (const [index, canvas] of canvases.entries()) {
				const actual = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
				if (!actual) throw new Error("Missing active preview pixels.");
				const pdfPage = await pdfDocument.getPage(index + 1);
				const baseViewport = pdfPage.getViewport({ scale: 1 });
				const reference = globalThis.document.createElement("canvas");
				reference.width = canvas.width;
				reference.height = canvas.height;
				canvas.parentElement?.append(reference);
				const context = reference.getContext("2d");
				if (!context) throw new Error("Missing reference canvas context.");
				context.direction = "ltr";
				await pdfPage.render({
					canvas: reference,
					canvasContext: context,
					viewport: baseViewport,
					transform: [4, 0, 0, 4, 0, 0],
					annotationMode: pdfjs.AnnotationMode.DISABLE,
					background: "white",
				}).promise;
				const expected = context.getImageData(0, 0, reference.width, reference.height);
				let differentPixels = 0;
				for (let offset = 0; offset < actual.data.length; offset += 4) {
					if (
						actual.data[offset] !== expected.data[offset] ||
						actual.data[offset + 1] !== expected.data[offset + 1] ||
						actual.data[offset + 2] !== expected.data[offset + 2] ||
						actual.data[offset + 3] !== expected.data[offset + 3]
					) {
						differentPixels += 1;
					}
				}
				pages.push({ differentPixels, height: canvas.height, width: canvas.width });
				reference.remove();
				pdfPage.cleanup();
			}
			return {
				pages,
			};
		} finally {
			await task.destroy();
		}
	}, Array.from(bytes));
}

function expectSamePdfGeometry(preview: PdfGeometry, downloaded: PdfGeometry, label: string) {
	expect(downloaded.pageCount, `${label}: page count`).toBe(preview.pageCount);
	for (const [index, previewPage] of preview.pages.entries()) {
		const downloadedPage = downloaded.pages[index];
		expect(downloadedPage, `${label}: page ${index + 1}`).toBeDefined();
		if (!downloadedPage) continue;
		expect(downloadedPage.mediaBox.width, `${label}: page ${index + 1} width`).toBeCloseTo(
			previewPage.mediaBox.width,
			2,
		);
		expect(downloadedPage.mediaBox.height, `${label}: page ${index + 1} height`).toBeCloseTo(
			previewPage.mediaBox.height,
			2,
		);
		expect(downloadedPage.inkBounds, `${label}: page ${index + 1} ink`).toEqual(previewPage.inkBounds);
		expect(downloadedPage.sentinels, `${label}: page ${index + 1} sentinels`).toEqual(previewPage.sentinels);
	}
}

async function setZoom(page: Page, zoom: 75 | 100 | 115) {
	const zoomLevel = page.getByRole("button", { name: "Zoom level", exact: true });
	if (zoom === 75) {
		await expect(zoomLevel).toHaveText("75%");
		return;
	}
	if (zoom === 100) {
		await zoomLevel.click();
		await page.getByRole("menuitem", { name: "Actual size (100%)", exact: true }).click();
		await expect(zoomLevel).toHaveText("100%");
		return;
	}
	await setZoom(page, 100);
	await page.getByRole("button", { name: "Zoom in", exact: true }).click();
	await expect(zoomLevel).toHaveText("115%");
}

async function runGeometryMatrix(page: Page, testInfo: TestInfo, scenarios: GeometryScenario[], expectedDpr: number) {
	dedicatedDatabaseUrl();
	await page.setViewportSize({ width: 1920, height: 1000 });
	await installPreviewCapture(page);
	await createSampleResumeFromDashboard(page, testInfo);
	const resumeId = new URL(page.url()).pathname.match(/^\/builder\/([^/]+)/)?.[1];
	if (!resumeId) throw new Error("Missing synthetic geometry resume id.");

	for (const scenario of scenarios) {
		const data = createFixture(scenario);
		await updateFixture(resumeId, data);
		const sourcePath = testInfo.outputPath(`${scenarioName(scenario)}.source.json`);
		await writeFile(sourcePath, JSON.stringify(data, null, 2));
		await page.goto(`/builder/${resumeId}`);
		await expect(page.locator('section[aria-label="Resume content"]')).toContainText(scenarioName(scenario));
		const { bytes: previewBytes, geometry: previewPdf } = await capturePreviewBytes(page, scenarioName(scenario));
		await writeFile(testInfo.outputPath(`${scenarioName(scenario)}.preview.pdf`), previewBytes);
		const zoomReports: Array<{ previewGeometry: PreviewGeometry; downloadedPdf: PdfGeometry; zoom: number }> = [];

		for (const zoom of [75, 100, 115] as const) {
			await setZoom(page, zoom);
			await page.waitForTimeout(500);
			const previewGeometry = await capturePreviewGeometry(page);
			expect(previewGeometry.devicePixelRatio).toBe(expectedDpr);
			expect(previewGeometry.viewport).toEqual({ height: 1000, width: 1920 });
			expect(previewGeometry.viewportClip.clientWidth).toBeGreaterThanOrEqual(1920);
			expect(previewGeometry.viewportClip.clientHeight).toBeGreaterThanOrEqual(1000);
			expect(previewGeometry.viewportClip.scrollWidth).toBeGreaterThanOrEqual(1920);
			expect(previewGeometry.viewportClip.scrollHeight).toBeGreaterThanOrEqual(1000);
			const pending = page.waitForEvent("download");
			await openSidebarSection(page, "Export");
			await page.getByRole("button", { name: "Choose PDF, DOCX, Markdown, or JSON" }).click();
			await page.getByRole("button", { name: "Download PDF", exact: true }).click();
			const download = await pending;
			const downloadPath = testInfo.outputPath(`${scenarioName(scenario)}.zoom-${zoom}.pdf`);
			await download.saveAs(downloadPath);
			const downloadBytes = new Uint8Array(await readFile(downloadPath));
			const downloadedPdf = await inspectPdf(downloadBytes);
			expectSamePdfGeometry(previewPdf, downloadedPdf, `${scenarioName(scenario)} zoom ${zoom}`);
			const sourcePixelDiff = await comparePreviewToPdf(page, previewBytes);
			const pixelDiff = await comparePreviewToPdf(page, downloadBytes);
			await writeFile(
				testInfo.outputPath(`${scenarioName(scenario)}.zoom-${zoom}.pixel-diff.json`),
				JSON.stringify({ downloaded: pixelDiff.pages, preview: sourcePixelDiff.pages }, null, 2),
			);
			expect(sourcePixelDiff.pages, `${scenarioName(scenario)} zoom ${zoom} active preview vs captured source`).toEqual(
				previewGeometry.pages.map((page) => ({
					differentPixels: 0,
					height: page.canvas.height,
					width: page.canvas.width,
				})),
			);
			expect(pixelDiff.pages, `${scenarioName(scenario)} zoom ${zoom} active preview vs download`).toEqual(
				previewGeometry.pages.map((page) => ({
					differentPixels: 0,
					height: page.canvas.height,
					width: page.canvas.width,
				})),
			);
			for (const pageGeometry of previewGeometry.pages) {
				const pdfPage = previewPdf.pages[previewGeometry.pages.indexOf(pageGeometry)];
				expect(pdfPage).toBeDefined();
				if (!pdfPage) continue;
				expect(pageGeometry.canvas.cssWidth, `${scenarioName(scenario)} CSS width`).toBeCloseTo(
					pdfPage.mediaBox.width,
					1,
				);
				expect(pageGeometry.canvas.cssHeight, `${scenarioName(scenario)} CSS height`).toBeCloseTo(
					pdfPage.mediaBox.height,
					1,
				);
				expect(
					Math.abs(pageGeometry.canvas.width - pageGeometry.canvas.cssWidth * 4),
					`${scenarioName(scenario)} bitmap width`,
				).toBeLessThan(1);
				expect(
					Math.abs(pageGeometry.canvas.height - pageGeometry.canvas.cssHeight * 4),
					`${scenarioName(scenario)} bitmap height`,
				).toBeLessThan(1);
				expect(pageGeometry.wrapper.width, `${scenarioName(scenario)} wrapper/canvas width`).toBeCloseTo(
					pageGeometry.canvasRect.width,
					1,
				);
				expect(pageGeometry.wrapper.height, `${scenarioName(scenario)} wrapper/canvas height`).toBeCloseTo(
					pageGeometry.canvasRect.height,
					1,
				);
				expect(
					pageGeometry.canvasRect.width / pageGeometry.canvas.cssWidth,
					`${scenarioName(scenario)} zoom`,
				).toBeCloseTo(zoom / 100, 2);
				expect(pageGeometry.wrapper.width, `${scenarioName(scenario)} wrapper width`).toBeGreaterThan(0);
				expect(pageGeometry.wrapper.height, `${scenarioName(scenario)} wrapper height`).toBeGreaterThan(0);
				expect(pageGeometry.canvas.width, `${scenarioName(scenario)} canvas bitmap width`).toBeGreaterThan(0);
				expect(pageGeometry.canvas.height, `${scenarioName(scenario)} canvas bitmap height`).toBeGreaterThan(0);
			}
			zoomReports.push({ downloadedPdf, previewGeometry, zoom });
			await page.keyboard.press("Escape");
		}

		const report = {
			devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
			format: scenario.format,
			marginY: scenario.marginY,
			overflow: scenario.overflow,
			previewPdf,
			zoomReports,
		};
		await writeFile(testInfo.outputPath(`${scenarioName(scenario)}.metrics.json`), JSON.stringify(report, null, 2));
	}
}

test.describe("preview/export geometry at DPR1", () => {
	test.use({ deviceScaleFactor: 1 });

	test("matches active preview and downloaded PDF across synthetic Rhyhorn matrix", async ({ authPage }, testInfo) => {
		test.setTimeout(600_000);
		await runGeometryMatrix(authPage, testInfo, SCENARIOS, 1);
	});
});

test.describe("preview/export geometry at DPR2", () => {
	test.use({ deviceScaleFactor: 2 });

	test("matches active preview and downloaded PDF at higher device pixel ratio", async ({ authPage }, testInfo) => {
		test.setTimeout(180_000);
		await runGeometryMatrix(
			authPage,
			testInfo,
			[{ format: "a4", marginY: defaultResumeData.metadata.page.marginY, overflow: true }],
			2,
		);
	});
});
