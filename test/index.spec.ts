import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("shinoda-fairy-bot worker", () => {
	it("responds to GET with alive message (unit style)", async () => {
		const request = new IncomingRequest("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env as never, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toBe("shinoda-fairy-bot is alive");
	});

	it("rejects POST without signature (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/webhook", {
			method: "POST",
			body: "{}",
		});
		expect(response.status).toBe(403);
	});
});
