import { config } from "../config.js";

async function checkUrl(monitor) {
    const startedAt = Date.now();

    try {
        const response = await fetch(monitor.url, {
            signal: AbortSignal.timeout(config.CHECK_TIMEOUT_MS),
        });

        const latencyMs = Date.now() - startedAt;

        if (response.status === monitor.expected_status) {
            return {
                ok: true,
                status_code: response.status,
                latency_ms: latencyMs,
                error: null,
            };
        }

        return {
            ok: false,
            status_code: response.status,
            latency_ms: latencyMs,
            error: `Expected status ${monitor.expected_status}, received ${response.status}`,
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;

        if (error.name === "TimeoutError") {
            return {
                ok: false,
                status_code: null,
                latency_ms: latencyMs,
                error: "Request timed out",
            };
        }

        if (error.name === "AbortError") {
            return {
                ok: false,
                status_code: null,
                latency_ms: latencyMs,
                error: "Request aborted",
            };
        }

        return {
            ok: false,
            status_code: null,
            latency_ms: latencyMs,
            error: error.message || "Network request failed",
        };
    }
}

export { checkUrl };