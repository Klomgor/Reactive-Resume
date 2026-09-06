import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { offlineFontScriptSamples, seedOfflineFontResume } from "../fixtures/offline-fonts";
import { createSampleResumeFromDashboard, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

const diagnosticEnabled = process.env.OFFLINE_FONT_DIAGNOSTIC === "1";
const serverRestartConfirmed = process.env.OFFLINE_FONT_DIAGNOSTIC_SERVER_RESTARTED === "1";

type BlockedRequest = {
	hostname: string;
	path: string;
};

type ColdContext = {
	context: BrowserContext;
	blockedRequests: BlockedRequest[];
};

type PdfMarkers = Record<(typeof offlineFontScriptSamples)[number]["name"], boolean>;

test.describe("offline font diagnostic", () => {
	test.describe.configure({ mode: "serial" });
	test.skip(!diagnosticEnabled, "Set OFFLINE_FONT_DIAGNOSTIC=1 to run network diagnostics.");
	test.setTimeout(120_000);

	async function createColdContext(browser: Browser, page: Page, testInfo: TestInfo): Promise<ColdContext> {
		const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
		const allowedOrigin = new URL(baseURL).origin;
		const context = await browser.newContext({
			baseURL,
			serviceWorkers: "block",
			storageState: await page.context().storageState(),
		});
		const blockedRequests: BlockedRequest[] = [];

		await context.route("**/*", async (route) => {
			const requestURL = new URL(route.request().url());
			if (requestURL.origin === allowedOrigin || requestURL.protocol === "data:" || requestURL.protocol === "blob:") {
				await route.continue();
				return;
			}

			blockedRequests.push({ hostname: requestURL.hostname, path: requestURL.pathname });
			await route.abort("blockedbyclient");
		});

		return { context, blockedRequests };
	}

	function markerResult(text: string): PdfMarkers {
		return Object.fromEntries(
			offlineFontScriptSamples.map((sample) => [sample.name, text.includes(sample.marker)]),
		) as PdfMarkers;
	}

	function networkStatus(blockedRequests: BlockedRequest[]) {
		return blockedRequests.length > 0 ? "network-error" : "no-browser-network-error";
	}

	async function readPdfText(bytes: Uint8Array) {
		const loadingTask = getDocument({ data: bytes, useSystemFonts: false });
		try {
			const document = await loadingTask.promise;
			const pages: string[] = [];
			for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
				const pdfPage = await document.getPage(pageNumber);
				pages.push(...(await pdfPage.getTextContent()).items.flatMap((item) => ("str" in item ? [item.str] : [])));
			}
			return pages.join(" ");
		} finally {
			await loadingTask.destroy();
		}
	}

	async function report(testInfo: TestInfo, name: string, reportData: Record<string, unknown>) {
		const body = JSON.stringify({
			version: 1,
			fixture: "offline-font-scripts-v1",
			surface: name,
			...reportData,
		});
		expect(body).not.toMatch(/https?:\/\/|[?&](token|secret|password|auth)=/i);
		await testInfo.attach(`${name}.json`, { body, contentType: "application/json" });
		console.log(`[offline-fonts] ${body}`);
	}

	test("captures cold font picker preview requests", async ({ browser, authPage: seedPage }, testInfo) => {
		await createSampleResumeFromDashboard(seedPage, testInfo);
		const fixture = await seedOfflineFontResume(seedPage);
		const cold = await createColdContext(browser, seedPage, testInfo);
		const page = await cold.context.newPage();
		try {
			await page.goto(fixture.builderURL);
			await openSidebarSection(page, "Typography");
			await page.getByRole("combobox").first().click();
			await expect(page.getByRole("option").first()).toBeVisible();
			await page.waitForTimeout(1_000);
			await report(testInfo, "picker-preview", {
				cache: "new-browser-context",
				blockedExternalFontRequests: cold.blockedRequests,
				networkStatus: networkStatus(cold.blockedRequests),
				glyphStatus: "not-applicable-picker-only",
			});
		} finally {
			await cold.context.close();
		}
	});

	test("captures cold builder PDF preview and classifies glyph/network results", async ({
		browser,
		authPage: seedPage,
	}, testInfo) => {
		await createSampleResumeFromDashboard(seedPage, testInfo);
		const fixture = await seedOfflineFontResume(seedPage);
		const cold = await createColdContext(browser, seedPage, testInfo);
		const page = await cold.context.newPage();
		try {
			await page.goto(fixture.builderURL);
			await page.waitForTimeout(5_000);
			const canvasVisible = await page
				.locator('[aria-hidden="false"] canvas')
				.first()
				.isVisible()
				.catch(() => false);
			await report(testInfo, "builder-preview", {
				cache: "new-browser-context",
				blockedExternalFontRequests: cold.blockedRequests,
				networkStatus: networkStatus(cold.blockedRequests),
				canvasVisible,
				glyphStatus: "not-measured-preview-canvas",
			});
		} finally {
			await cold.context.close();
		}
	});

	test("captures cold browser PDF download and classifies extracted glyphs", async ({
		browser,
		authPage: seedPage,
	}, testInfo) => {
		await createSampleResumeFromDashboard(seedPage, testInfo);
		const fixture = await seedOfflineFontResume(seedPage);
		const cold = await createColdContext(browser, seedPage, testInfo);
		const page = await cold.context.newPage();
		let markerResultValue: PdfMarkers | null = null;
		let downloadStatus = "not-started";
		try {
			await page.goto(fixture.builderURL);
			await openSidebarSection(page, "Export");
			await page.getByRole("button", { name: /Choose PDF, DOCX, Markdown, or JSON/ }).click();
			const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
			await page.getByRole("button", { name: "Download PDF", exact: true }).click();
			const download = await downloadPromise;
			downloadStatus = "received";
			const path = testInfo.outputPath("offline-font-browser-download.pdf");
			await download.saveAs(path);
			markerResultValue = markerResult(await readPdfText(new Uint8Array(await readFile(path))));
		} catch {
			downloadStatus = "renderer-or-network-error";
		} finally {
			await report(testInfo, "browser-download", {
				cache: "new-browser-context",
				blockedExternalFontRequests: cold.blockedRequests,
				networkStatus: networkStatus(cold.blockedRequests),
				downloadStatus,
				glyphStatus: markerResultValue ?? "not-extracted",
			});
			await cold.context.close();
		}
	});

	test("exercises restarted-server PDF and records server observability boundary", async ({
		browser,
		authPage: seedPage,
	}, testInfo) => {
		await createSampleResumeFromDashboard(seedPage, testInfo);
		const fixture = await seedOfflineFontResume(seedPage);
		const cold = await createColdContext(browser, seedPage, testInfo);
		const page = await cold.context.newPage();
		let responseStatus = "not-requested";
		let markerResultValue: PdfMarkers | null = null;
		try {
			await page.goto(fixture.builderURL);
			if (!serverRestartConfirmed) {
				responseStatus = "blocked-before-request";
			} else {
				const response = await page.request.get(
					`/api/resumes/${encodeURIComponent(fixture.username)}/${encodeURIComponent(fixture.slug)}/pdf`,
				);
				responseStatus = String(response.status());
				if (response.ok()) {
					const bytes = await response.body();
					await writeFile(testInfo.outputPath("offline-font-server.pdf"), bytes);
					markerResultValue = markerResult(await readPdfText(new Uint8Array(bytes)));
				}
			}
		} finally {
			await report(testInfo, "server-pdf", {
				cache: "new-browser-context; server-process-state-is-external",
				serverRestartConfirmed,
				blockedExternalFontRequests: cold.blockedRequests,
				networkStatus: "server-outbound-requests-unobservable-from-playwright",
				responseStatus,
				glyphStatus: markerResultValue ?? "not-extracted",
				limitation:
					"Playwright route interception sees browser requests only; server fetches need a restarted process plus host-level egress capture.",
			});
			await cold.context.close();
		}
	});
});
