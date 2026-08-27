import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { pool } from "../src/db.js";
import { runCheck } from "../src/checker/checkRunner.js";
import { runSchedulerTick } from "../src/scheduler/monitorScheduler.js";

let testServer;
let testUrl;
let monitorId;
let timeoutMonitorId;
let healthyMonitorId;

before(async () => {
    testServer = http.createServer((req, res) => {
        if (req.url === "/timeout") {
            return;
        }

        if (req.url === "/failure") {
            res.writeHead(500, {
                "Content-Type": "text/plain",
            });

            res.end("Server error");
            return;
        }

        res.writeHead(200, {
            "Content-Type": "text/plain",
        });

        res.end("Healthy test server");
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
            `${testUrl}/healthy`,
            10,
            200,
            true,
        ],
    );

    monitorId = result.rows[0].id;

    const timeoutResult = await pool.query(
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
            "Scheduler Timeout Monitor",
            `${testUrl}/timeout`,
            10,
            200,
            true,
        ],
    );

    timeoutMonitorId = timeoutResult.rows[0].id;

    const healthyResult = await pool.query(
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
            "Scheduler Healthy Monitor",
            `${testUrl}/healthy`,
            10,
            200,
            true,
        ],
    );

    healthyMonitorId = healthyResult.rows[0].id;
});

after(async () => {
    await pool.query(
        `
        DELETE FROM incidents
        WHERE monitor_id IN ($1, $2, $3)
        `,
        [monitorId, timeoutMonitorId, healthyMonitorId],
    );

    await pool.query(
        `
        DELETE FROM checks
        WHERE monitor_id IN ($1, $2, $3)
        `,
        [monitorId, timeoutMonitorId, healthyMonitorId],
    );

    await pool.query(
        `
        DELETE FROM monitors
        WHERE id IN ($1, $2, $3)
        `,
        [monitorId, timeoutMonitorId, healthyMonitorId],
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
        url: `${testUrl}/healthy`,
        expected_status: 200,
    };

    const result = await runCheck(monitor);

    assert.equal(result.ok, true);
    assert.equal(result.status_code, 200);
    assert.equal(result.error, null);
});

test("non-2xx response opens an incident", async () => {
    const monitor = {
        id: monitorId,
        name: "Scheduler Test Monitor",
        url: `${testUrl}/failure`,
        expected_status: 200,
    };

    const result = await runCheck(monitor);

    assert.equal(result.ok, false);
    assert.equal(result.status_code, 500);
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

test("timeout produces a failed check and opens an incident", async () => {
    const monitor = {
        id: timeoutMonitorId,
        name: "Scheduler Timeout Monitor",
        url: `${testUrl}/timeout`,
        expected_status: 200,
    };

    const result = await runCheck(monitor);

    assert.equal(result.ok, false);
    assert.equal(result.status_code, null);
    assert.match(result.error, /timed out|timeout/i);

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
        [timeoutMonitorId],
    );

    assert.equal(incidentResult.rows.length, 1);
    assert.equal(
        incidentResult.rows[0].monitor_id,
        timeoutMonitorId,
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
        url: `${testUrl}/healthy`,
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

test("scheduler continues running after a failing monitor", async () => {
    await pool.query(
        `
        DELETE FROM incidents
        WHERE monitor_id IN ($1, $2)
        `,
        [timeoutMonitorId, healthyMonitorId],
    );

    await pool.query(
        `
        DELETE FROM checks
        WHERE monitor_id IN ($1, $2)
        `,
        [timeoutMonitorId, healthyMonitorId],
    );

    const originalTimeout = process.env.CHECK_TIMEOUT_MS;

    process.env.CHECK_TIMEOUT_MS = "1000";

    try {
        await runSchedulerTick();
    } finally {
        process.env.CHECK_TIMEOUT_MS = originalTimeout;
    }

    const timeoutChecks = await pool.query(
        `
        SELECT
            ok,
            error
        FROM checks
        WHERE monitor_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [timeoutMonitorId],
    );

    const healthyChecks = await pool.query(
        `
        SELECT
            ok,
            status_code,
            error
        FROM checks
        WHERE monitor_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [healthyMonitorId],
    );

    assert.equal(timeoutChecks.rows.length, 1);
    assert.equal(timeoutChecks.rows[0].ok, false);
    assert.match(
        timeoutChecks.rows[0].error,
        /timed out|timeout/i,
    );

    assert.equal(healthyChecks.rows.length, 1);
    assert.equal(healthyChecks.rows[0].ok, true);
    assert.equal(healthyChecks.rows[0].status_code, 200);
    assert.equal(healthyChecks.rows[0].error, null);
});