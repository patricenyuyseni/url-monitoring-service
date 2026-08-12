import { pool } from "../db.js";

async function getOpenIncident(client, monitorId) {
    const result = await client.query(
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
        LIMIT 1
        `,
        [monitorId],
    );

    return result.rows[0] || null;
}

async function openIncident(monitorId, cause) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const existingIncident = await getOpenIncident(
            client,
            monitorId,
        );

        if (existingIncident) {
            await client.query("COMMIT");
            return existingIncident;
        }

        const result = await client.query(
            `
            INSERT INTO incidents (
                monitor_id,
                cause
            )
            VALUES ($1, $2)
            RETURNING
                id,
                monitor_id,
                started_at,
                resolved_at,
                cause
            `,
            [monitorId, cause],
        );

        await client.query("COMMIT");

        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function resolveIncident(monitorId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
            UPDATE incidents
            SET resolved_at = now()
            WHERE monitor_id = $1
              AND resolved_at IS NULL
            RETURNING
                id,
                monitor_id,
                started_at,
                resolved_at,
                cause
            `,
            [monitorId],
        );

        await client.query("COMMIT");

        return result.rows[0] || null;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function getIncidents({ after, limit }) {
    const values = [];
    let query = `
        SELECT
            id,
            monitor_id,
            started_at,
            resolved_at,
            cause
        FROM incidents
    `;

    if (after !== undefined) {
        values.push(after);
        query += ` WHERE id > $${values.length}`;
    }

    values.push(limit);

    query += `
        ORDER BY id ASC
        LIMIT $${values.length}
    `;

    const result = await pool.query(query, values);

    const rows = result.rows;

    const nextCursor =
        rows.length === limit
            ? rows[rows.length - 1].id
            : null;

    return {
        data: rows,
        next_cursor: nextCursor,
    };
}

async function getIncidentsByMonitor(
    monitorId,
    { after, limit },
) {
    const values = [monitorId];

    let query = `
        SELECT
            id,
            monitor_id,
            started_at,
            resolved_at,
            cause
        FROM incidents
        WHERE monitor_id = $1
    `;

    if (after !== undefined) {
        values.push(after);
        query += ` AND id > $${values.length}`;
    }

    values.push(limit);

    query += `
        ORDER BY id ASC
        LIMIT $${values.length}
    `;

    const result = await pool.query(query, values);

    const rows = result.rows;

    const nextCursor =
        rows.length === limit
            ? rows[rows.length - 1].id
            : null;

    return {
        data: rows,
        next_cursor: nextCursor,
    };
}

export {
    openIncident,
    resolveIncident,
    getIncidents,
    getIncidentsByMonitor,
};