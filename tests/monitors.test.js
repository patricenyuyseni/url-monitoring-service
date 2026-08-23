import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import { pool } from "../src/db.js";

let server;
let baseUrl;
const createdMonitorIds = [];

before(async () => {
    server = app.listen(0);

    await new Promise((resolve) => {
        server.on("listening", resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    // Clean up monitors created by this test file.
    // Delete dependent records first.
    if (createdMonitorIds.length > 0) {
        await pool.query(
            `
            DELETE FROM incidents
            WHERE monitor_id = ANY($1::int[])
            `,
            [createdMonitorIds],
        );

        await pool.query(
            `
            DELETE FROM checks
            WHERE monitor_id = ANY($1::int[])
            `,
            [createdMonitorIds],
        );

        await pool.query(
            `
            DELETE FROM monitors
            WHERE id = ANY($1::int[])
            `,
            [createdMonitorIds],
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

async function createTestMonitor(name) {
    const response = await fetch(`${baseUrl}/monitors`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            url: "https://example.com",
            interval_seconds: 60,
            expected_status: 200,
        }),
    });

    assert.equal(response.status, 201);

    const body = await response.json();

    createdMonitorIds.push(body.id);

    return body;
}

test("GET /health returns 200", async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.deepEqual(body, {
        status: "ok",
    });
});

test("POST /monitors creates a monitor", async () => {
    const monitor = await createTestMonitor("Test Monitor");

    assert.equal(monitor.name, "Test Monitor");
    assert.equal(monitor.url, "https://example.com");
    assert.equal(monitor.interval_seconds, 60);
    assert.equal(monitor.expected_status, 200);
    assert.equal(monitor.is_active, true);
});

test("POST /monitors rejects invalid URL", async () => {
    const response = await fetch(`${baseUrl}/monitors`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: "Invalid Monitor",
            url: "ftp://example.com",
            interval_seconds: 60,
            expected_status: 200,
        }),
    });

    assert.equal(response.status, 400);

    const body = await response.json();

    assert.equal(body.error, "Validation failed");
});

test("GET /monitors returns paginated monitors", async () => {
    const response = await fetch(`${baseUrl}/monitors?limit=10`);

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.ok(Array.isArray(body.data));
    assert.ok("next_cursor" in body);
});

test("GET /monitors/:id returns a monitor", async () => {
    const created = await createTestMonitor("Get By ID Test");

    const response = await fetch(
        `${baseUrl}/monitors/${created.id}`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.id, created.id);
    assert.equal(body.name, "Get By ID Test");
});

test("GET /monitors/:id returns 404 for missing monitor", async () => {
    const response = await fetch(
        `${baseUrl}/monitors/999999`,
    );

    assert.equal(response.status, 404);

    const body = await response.json();

    assert.equal(body.error, "Monitor not found");
});

test("PATCH /monitors/:id updates a monitor", async () => {
    const created = await createTestMonitor("Update Test");

    const response = await fetch(
        `${baseUrl}/monitors/${created.id}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Updated Monitor",
            }),
        },
    );

    assert.equal(response.status, 204);

    const getResponse = await fetch(
        `${baseUrl}/monitors/${created.id}`,
    );

    assert.equal(getResponse.status, 200);

    const updated = await getResponse.json();

    assert.equal(updated.name, "Updated Monitor");
});

test("DELETE /monitors/:id deletes a monitor", async () => {
    const created = await createTestMonitor("Delete Test");

    const response = await fetch(
        `${baseUrl}/monitors/${created.id}`,
        {
            method: "DELETE",
        },
    );

    assert.equal(response.status, 204);

    const getResponse = await fetch(
        `${baseUrl}/monitors/${created.id}`,
    );

    assert.equal(getResponse.status, 404);

    // It was already deleted, so don't try to delete it again.
    const index = createdMonitorIds.indexOf(created.id);

    if (index !== -1) {
        createdMonitorIds.splice(index, 1);
    }
});