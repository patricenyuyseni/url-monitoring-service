import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import { pool } from "../src/db.js";

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);

    await new Promise((resolve) => {
        server.on("listening", resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
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

test("GET /health returns 200", async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.deepEqual(body, {
        status: "ok",
    });
});

test("POST /monitors creates a monitor", async () => {
    const response = await fetch(`${baseUrl}/monitors`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: "Test Monitor",
            url: "https://example.com",
            interval_seconds: 60,
            expected_status: 200,
        }),
    });

    assert.equal(response.status, 201);

    const body = await response.json();

    assert.equal(body.name, "Test Monitor");
    assert.equal(body.url, "https://example.com");
    assert.equal(body.interval_seconds, 60);
    assert.equal(body.expected_status, 200);
    assert.equal(body.is_active, true);
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
    const createResponse = await fetch(
        `${baseUrl}/monitors`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Get By ID Test",
                url: "https://example.com",
                interval_seconds: 60,
                expected_status: 200,
            }),
        },
    );

    const created = await createResponse.json();

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
    const createResponse = await fetch(
        `${baseUrl}/monitors`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Update Test",
                url: "https://example.com",
                interval_seconds: 60,
                expected_status: 200,
            }),
        },
    );

    const created = await createResponse.json();

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

    const updated = await getResponse.json();

    assert.equal(updated.name, "Updated Monitor");
});

test("DELETE /monitors/:id deletes a monitor", async () => {
    const createResponse = await fetch(
        `${baseUrl}/monitors`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Delete Test",
                url: "https://example.com",
                interval_seconds: 60,
                expected_status: 200,
            }),
        },
    );

    const created = await createResponse.json();

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
});