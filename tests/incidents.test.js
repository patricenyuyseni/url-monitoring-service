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
            "Incident Test Monitor",
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

test("GET /monitors/:monitorId/incidents returns incidents", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/${monitorId}/incidents?limit=10`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.ok(Array.isArray(body.data));
    assert.ok("next_cursor" in body);
});

test("openIncident creates an incident", async () => {
    const { openIncident } = await import(
        "../src/services/incidentService.js"
    );

    const incident = await openIncident(
        monitorId,
        "Test failure",
    );

    assert.ok(incident.id);
    assert.equal(incident.monitor_id, monitorId);
    assert.equal(incident.cause, "Test failure");
    assert.equal(incident.resolved_at, null);
});

test("openIncident does not create duplicate open incidents", async () => {
    const { openIncident } = await import(
        "../src/services/incidentService.js"
    );

    const first = await openIncident(
        monitorId,
        "Test failure",
    );

    const second = await openIncident(
        monitorId,
        "Another failure",
    );

    assert.equal(second.id, first.id);
    assert.equal(second.cause, first.cause);

    const result = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM incidents
        WHERE monitor_id = $1
          AND resolved_at IS NULL
        `,
        [monitorId],
    );

    assert.equal(result.rows[0].count, 1);
});

test("resolveIncident resolves the open incident", async () => {
    const { resolveIncident } = await import(
        "../src/services/incidentService.js"
    );

    const resolved = await resolveIncident(monitorId);

    assert.ok(resolved);
    assert.equal(resolved.monitor_id, monitorId);
    assert.ok(resolved.resolved_at);
});

test("GET /monitors/:monitorId/incidents returns 404 for missing monitor", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/999999/incidents`,
    );

    assert.equal(response.status, 404);

    const body = await response.json();

    assert.equal(body.error, "Monitor not found");
});