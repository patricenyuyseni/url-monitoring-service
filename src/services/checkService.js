import { pool } from "../db.js";

async function createCheck(data) {
    const result = await pool.query(
        `
        INSERT INTO checks (
            monitor_id,
            checked_at,
            ok,
            status_code,
            latency_ms,
            error
        )
        VALUES ($1, COALESCE($2, now()), $3, $4, $5, $6)
        RETURNING
            id,
            monitor_id,
            checked_at,
            ok,
            status_code,
            latency_ms,
            error
        `,
        [
            data.monitor_id,
            data.checked_at ?? null,
            data.ok,
            data.status_code ?? null,
            data.latency_ms ?? null,
            data.error ?? null,
        ],
    );

    return result.rows[0];
}

async function getChecks(monitorId, { after, limit }) {
    const values = [monitorId];

    let query = `
        SELECT
            id,
            monitor_id,
            checked_at,
            ok,
            status_code,
            latency_ms,
            error
        FROM checks
        WHERE monitor_id = $1
    `;

    if (after !== undefined) {
        query += ` AND id > $${values.length + 1}`;
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

async function streamChecksCsv(monitorId, res) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `
            SELECT
                id,
                monitor_id,
                checked_at,
                ok,
                status_code,
                latency_ms,
                error
            FROM checks
            WHERE monitor_id = $1
            ORDER BY id ASC
            `,
            [monitorId],
        );

        res.write(
            "id,monitor_id,checked_at,ok,status_code,latency_ms,error\n",
        );

        for (const row of result.rows) {
            const values = [
                row.id,
                row.monitor_id,
                row.checked_at?.toISOString() ?? "",
                row.ok,
                row.status_code ?? "",
                row.latency_ms ?? "",
                csvEscape(row.error ?? ""),
            ];

            res.write(`${values.join(",")}\n`);
        }

        res.end();
    } catch (error) {
        res.destroy(error);
    } finally {
        client.release();
    }
}

function csvEscape(value) {
    const stringValue = String(value);

    if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
    ) {
        return `"${stringValue.replaceAll('"', '""')}"`;
    }

    return stringValue;
}

export {
    createCheck,
    getChecks,
    streamChecksCsv,
};