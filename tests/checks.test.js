import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import { pool } from "../src/db.js";

let server;
let baseUrl;
let monitorId;

before(async () => {
    const monitorResult = await pool.query(
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
            "Checks Test Monitor",
            "https://example.com",
            60,
            200,
        ],
    );

    monitorId = monitorResult.rows[0].id;

    server = app.listen(0);

    await new Promise((resolve) => {
        server.on("listening", resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    if (monitorId) {
        await pool.query(
            "DELETE FROM checks WHERE monitor_id = $1",
            [monitorId],
        );

        await pool.query(
            "DELETE FROM monitors WHERE id = $1",
            [monitorId],
        );
    }

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

test("GET /monitors/:monitorId/checks returns checks", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/checks?limit=10`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.ok(Array.isArray(body.data));
    assert.ok("next_cursor" in body);
});

test("GET /monitors/:monitorId/checks returns created checks", async () => {
    const insertResult = await pool.query(
        `
        INSERT INTO checks (
            monitor_id,
            checked_at,
            ok,
            status_code,
            latency_ms,
            error
        )
        VALUES ($1, now(), $2, $3, $4, $5)
        RETURNING id
        `,
        [
            monitorId,
            true,
            200,
            250,
            null,
        ],
    );

    const checkId = insertResult.rows[0].id;

    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/checks?limit=10`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    const check = body.data.find(
        (item) => item.id === checkId,
    );

    assert.ok(check);
    assert.equal(check.monitor_id, monitorId);
    assert.equal(check.ok, true);
    assert.equal(check.status_code, 200);
    assert.equal(check.latency_ms, 250);
});

test("GET /monitors/:monitorId/checks supports pagination", async () => {
    await pool.query(
        `
        INSERT INTO checks (
            monitor_id,
            checked_at,
            ok,
            status_code,
            latency_ms
        )
        VALUES
            ($1, now(), true, 200, 100),
            ($1, now(), true, 200, 110),
            ($1, now(), true, 200, 120)
        `,
        [monitorId],
    );

    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/checks?limit=2`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.data.length, 2);
    assert.ok(body.next_cursor !== null);
});

test("GET /monitors/:monitorId/checks returns 404 for missing monitor", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/999999/checks`,
    );

    assert.equal(response.status, 404);

    const body = await response.json();

    assert.equal(body.error, "Monitor not found");
});

test("checks can represent a failed check", async () => {
    const insertResult = await pool.query(
        `
        INSERT INTO checks (
            monitor_id,
            checked_at,
            ok,
            status_code,
            latency_ms,
            error
        )
        VALUES ($1, now(), $2, $3, $4, $5)
        RETURNING id
        `,
        [
            monitorId,
            false,
            500,
            300,
            "Expected status 200, received 500",
        ],
    );

    const checkId = insertResult.rows[0].id;

    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/checks?limit=20`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    const check = body.data.find(
        (item) => item.id === checkId,
    );

    assert.ok(check);
    assert.equal(check.ok, false);
    assert.equal(check.status_code, 500);
    assert.equal(
        check.error,
        "Expected status 200, received 500",
    );
});