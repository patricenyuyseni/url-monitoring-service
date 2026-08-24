import { pool } from "../db.js";

// show

async function getMonitorUptime(monitorId, window) {
    const result = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER AS total_checks,
            COUNT(*) FILTER (WHERE ok = true)::INTEGER AS successful_checks,
            COALESCE(
                ROUND(
                    (
                        COUNT(*) FILTER (WHERE ok = true)::NUMERIC
                        / NULLIF(COUNT(*), 0)
                    ) * 100,
                    2
                ),
                0
            ) AS uptime_percentage,
            COALESCE(
                ROUND(AVG(latency_ms))::INTEGER,
                0
            ) AS average_latency_ms,
            COALESCE(
                (
                    SELECT latency_ms
                    FROM (
                        SELECT
                            latency_ms,
                            PERCENT_RANK() OVER (
                                ORDER BY latency_ms
                            ) AS percentile
                        FROM checks
                        WHERE monitor_id = $1
                          AND checked_at >= now() - $2::interval
                          AND latency_ms IS NOT NULL
                    ) latency_values
                    WHERE percentile >= 0.95
                    ORDER BY percentile
                    LIMIT 1
                ),
                0
            ) AS p95_latency_ms
        FROM checks
        WHERE monitor_id = $1
          AND checked_at >= now() - $2::interval
        `,
        [monitorId, window],
    );

    return result.rows[0];
}

export { getMonitorUptime };