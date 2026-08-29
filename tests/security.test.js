import test from "node:test";
import assert from "node:assert/strict";
import { createMonitorSchema } from "../src/schemas/monitorSchema.js";

test("monitor schema rejects unsafe URL schemes", () => {
    const unsafeUrls = [
        "javascript:alert(1)",
        "ftp://example.com",
        "file:///etc/passwd",
        "data:text/html,<script>alert(1)</script>",
    ];

    for (const url of unsafeUrls) {
        const result = createMonitorSchema.safeParse({
            name: "Security Test",
            url,
            interval_seconds: 10,
            expected_status: 200,
        });

        assert.equal(
            result.success,
            false,
            `Expected ${url} to be rejected`,
        );
    }
});

test("monitor schema accepts HTTP and HTTPS URLs", () => {
    const safeUrls = [
        "http://example.com",
        "https://example.com",
    ];

    for (const url of safeUrls) {
        const result = createMonitorSchema.safeParse({
            name: "Security Test",
            url,
            interval_seconds: 10,
            expected_status: 200,
        });

        assert.equal(
            result.success,
            true,
            `Expected ${url} to be accepted`,
        );
    }
});