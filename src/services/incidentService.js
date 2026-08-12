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

export {
    openIncident,
    resolveIncident,
};