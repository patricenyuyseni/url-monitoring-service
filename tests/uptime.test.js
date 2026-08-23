import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import { pool } from "../src/db.js";

let server;
let baseUrl;
let monitorId;

before(async () => {
    const result = await pool.query(
        `
        INSERT INTO monitors (
            name,
            url,
            interval_seconds,
            expected_status
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [
            "Uptime Test Monitor",
            "https://example.com",
            60,
            200,
        ],
    );

    monitorId = result.rows[0].id;

    await pool.query(
        `
        INSERT INTO checks (
            monitor_id,
            checked_at,
            ok,
            status_code,
            latency_ms,
            error
        )
        VALUES
            ($1, now(), true, 200, 100, null),
            ($1, now(), true, 200, 200, null),
            ($1, now(), false, 500, 300, 'Expected status 200, received 500')
        `,
        [monitorId],
    );

    server = app.listen(0);

    await new Promise((resolve) => {
        server.on("listening", resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await pool.query(
        "DELETE FROM incidents WHERE monitor_id = $1",
        [monitorId],
    );

    await pool.query(
        "DELETE FROM checks WHERE monitor_id = $1",
        [monitorId],
    );

    await pool.query(
        "DELETE FROM monitors WHERE id = $1",
        [monitorId],
    );

    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

    await pool.end();
});

test("GET /monitors/:monitorId/uptime returns uptime statistics", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/uptime`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.monitor_id, monitorId);
    assert.equal(body.window, "24h");
    assert.equal(body.total_checks, 3);
    assert.equal(body.successful_checks, 2);
    assert.equal(body.uptime_percentage, 66.67);
    assert.equal(body.average_latency_ms, 200);
    assert.ok(body.p95_latency_ms >= 200);
});

test("GET /monitors/:monitorId/uptime supports custom window", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/uptime?window=1h`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.monitor_id, monitorId);
    assert.equal(body.window, "1h");
});

test("GET /monitors/:monitorId/uptime rejects invalid window", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/uptime?window=10x`,
    );

    assert.equal(response.status, 400);

    const body = await response.json();

    assert.equal(body.error, "Validation failed");
});

test("GET /monitors/:monitorId/uptime returns 404 for missing monitor", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/999999/uptime`,
    );

    assert.equal(response.status, 404);

    const body = await response.json();

    assert.equal(body.error, "Monitor not found");
});
