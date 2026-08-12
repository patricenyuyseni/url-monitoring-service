import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { pool } from "../src/db.js";
import { runCheck } from "../src/checker/checkRunner.js";

let monitorId;
let testServer;
let testUrl;

before(async () => {
    testServer = http.createServer((req, res) => {
        res.writeHead(200, {
            "Content-Type": "text/plain",
        });

        res.end("Scheduler test server");
    });

    await new Promise((resolve, reject) => {
        testServer.once("error", reject);

        testServer.listen(0, "127.0.0.1", () => {
            resolve();
        });
    });

    const address = testServer.address();

    testUrl = `http://127.0.0.1:${address.port}`;

    const result = await pool.query(
        `
        INSERT INTO monitors (
            name,
            url,
            interval_seconds,
            expected_status,
            is_active
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [
            "Scheduler Test Monitor",
            testUrl,
            10,
            200,
            true,
        ],
    );

    monitorId = result.rows[0].id;
});

after(async () => {
    await pool.query(
        `
        DELETE FROM incidents
        WHERE monitor_id = $1
        `,
        [monitorId],
    );

    await pool.query(
        `
        DELETE FROM checks
        WHERE monitor_id = $1
        `,
        [monitorId],
    );

    await pool.query(
        `
        DELETE FROM monitors
        WHERE id = $1
        `,
        [monitorId],
    );

    await new Promise((resolve, reject) => {
        testServer.close((error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

    await pool.end();
});

test("scheduler records a successful check", async () => {
    const monitor = {
        id: monitorId,
        name: "Scheduler Test Monitor",
        url: testUrl,
        expected_status: 200,
    };

    const result = await runCheck(monitor);

    assert.equal(result.ok, true);
    assert.equal(result.status_code, 200);
    assert.equal(result.error, null);
});

test("failed check opens an incident", async () => {
    const monitor = {
        id: monitorId,
        name: "Scheduler Test Monitor",
        url: testUrl,
        expected_status: 500,
    };

    const result = await runCheck(monitor);

    assert.equal(result.ok, false);
    assert.equal(result.status_code, 200);
    assert.ok(result.error);

    const incidentResult = await pool.query(
        `
        SELECT
            id,
            monitor_id,
            started_at,
            resolved_at,
            cause
        FROM incidents
        WHERE monitor_id = $1
          AND resolved_at IS NULL
        `,
        [monitorId],
    );

    assert.equal(incidentResult.rows.length, 1);
    assert.equal(
        incidentResult.rows[0].monitor_id,
        monitorId,
    );
    assert.equal(
        incidentResult.rows[0].resolved_at,
        null,
    );
});

test("recovery resolves the incident", async () => {
    const monitor = {
        id: monitorId,
        name: "Scheduler Test Monitor",
        url: testUrl,
        expected_status: 200,
    };

    const result = await runCheck(monitor);

    assert.equal(result.ok, true);
    assert.equal(result.status_code, 200);
    assert.equal(result.error, null);

    const incidentResult = await pool.query(
        `
        SELECT
            id,
            monitor_id,
            started_at,
            resolved_at,
            cause
        FROM incidents
        WHERE monitor_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [monitorId],
    );

    assert.equal(incidentResult.rows.length, 1);
    assert.ok(incidentResult.rows[0].resolved_at);
});