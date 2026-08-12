import { pool } from "../db.js";

async function createMonitor(data) {
    const result = await pool.query(
        `
        INSERT INTO monitors (
            name,
            url,
            interval_seconds,
            expected_status
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            name,
            url,
            interval_seconds,
            expected_status,
            is_active,
            created_at
        `,
        [
            data.name,
            data.url,
            data.interval_seconds,
            data.expected_status,
        ],
    );

    return result.rows[0];
}

async function getMonitors({ after, limit }) {
    const values = [];

    let query = `
        SELECT
            id,
            name,
            url,
            interval_seconds,
            expected_status,
            is_active,
            created_at
        FROM monitors
    `;

    if (after !== undefined) {
        query += " WHERE id > $1";
        values.push(after);
    }

    const limitParameter = values.length + 1;

    query += `
        ORDER BY id ASC
        LIMIT $${limitParameter}
    `;

    values.push(limit + 1);

    const result = await pool.query(query, values);

    const hasNextPage = result.rows.length > limit;

    const rows = hasNextPage
        ? result.rows.slice(0, limit)
        : result.rows;

    const nextCursor = hasNextPage
        ? rows[rows.length - 1].id
        : null;

    return {
        data: rows,
        next_cursor: nextCursor,
    };
}

async function getMonitorById(id) {
    const result = await pool.query(
        `
        SELECT
            id,
            name,
            url,
            interval_seconds,
            expected_status,
            is_active,
            created_at
        FROM monitors
        WHERE id = $1
        `,
        [id],
    );

    return result.rows[0] || null;
}

async function updateMonitor(id, data) {
    const allowedFields = {
        name: "name",
        url: "url",
        interval_seconds: "interval_seconds",
        expected_status: "expected_status",
        is_active: "is_active",
    };

    const fields = [];
    const values = [];

    for (const [field, value] of Object.entries(data)) {
        const column = allowedFields[field];

        if (!column) {
            continue;
        }

        values.push(value);
        fields.push(`${column} = $${values.length}`);
    }

    if (fields.length === 0) {
        return null;
    }

    values.push(id);

    const result = await pool.query(
        `
        UPDATE monitors
        SET ${fields.join(", ")}
        WHERE id = $${values.length}
        RETURNING
            id,
            name,
            url,
            interval_seconds,
            expected_status,
            is_active,
            created_at
        `,
        values,
    );

    return result.rows[0] || null;
}

async function deleteMonitor(id) {
    const result = await pool.query(
        `
        DELETE FROM monitors
        WHERE id = $1
        RETURNING id
        `,
        [id],
    );

    return result.rows[0] || null;
}

async function getDueMonitors() {
    const result = await pool.query(
        `
        SELECT
            m.id,
            m.name,
            m.url,
            m.interval_seconds,
            m.expected_status,
            m.is_active,
            m.created_at
        FROM monitors m
        LEFT JOIN LATERAL (
            SELECT checked_at
            FROM checks
            WHERE monitor_id = m.id
            ORDER BY checked_at DESC
            LIMIT 1
        ) c ON true
        WHERE m.is_active = true
          AND (
              c.checked_at IS NULL
              OR c.checked_at <= now() -
                  (m.interval_seconds * INTERVAL '1 second')
          )
        ORDER BY m.id ASC
        `,
    );

    return result.rows;
}

async function getPublicStatus() {
    const result = await pool.query(
        `
        SELECT
            m.id,
            m.name,
            m.url,
            m.expected_status,
            c.checked_at,
            c.ok,
            c.status_code,
            c.latency_ms,
            c.error,
            i.id AS incident_id,
            i.started_at AS incident_started_at,
            i.cause AS incident_cause
        FROM monitors m

        LEFT JOIN LATERAL (
            SELECT
                checked_at,
                ok,
                status_code,
                latency_ms,
                error
            FROM checks
            WHERE monitor_id = m.id
            ORDER BY checked_at DESC
            LIMIT 1
        ) c ON true

        LEFT JOIN LATERAL (
            SELECT
                id,
                started_at,
                cause
            FROM incidents
            WHERE monitor_id = m.id
              AND resolved_at IS NULL
            ORDER BY started_at DESC
            LIMIT 1
        ) i ON true

        WHERE m.is_active = true
        ORDER BY m.id ASC
        `,
    );

    return result.rows;
}

export {
    createMonitor,
    getMonitors,
    getMonitorById,
    updateMonitor,
    deleteMonitor,
    getDueMonitors,
    getPublicStatus,
};