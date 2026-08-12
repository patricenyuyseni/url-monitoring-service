import { getPublicStatus } from "./monitorService.js";

async function getStatus() {
    const monitors = await getPublicStatus();

    return {
        status: getOverallStatus(monitors),
        monitors: monitors.map((monitor) => ({
            id: monitor.id,
            name: monitor.name,
            url: monitor.url,
            state: getMonitorState(monitor),
            last_check: monitor.checked_at
                ? {
                      checked_at: monitor.checked_at,
                      ok: monitor.ok,
                      status_code:
                          monitor.status_code,
                      latency_ms:
                          monitor.latency_ms,
                      error: monitor.error,
                  }
                : null,
            incident: monitor.incident_id
                ? {
                      id: monitor.incident_id,
                      started_at:
                          monitor.incident_started_at,
                      cause: monitor.incident_cause,
                  }
                : null,
        })),
    };
}

function getMonitorState(monitor) {
    if (!monitor.checked_at) {
        return "unknown";
    }

    return monitor.ok ? "up" : "down";
}

function getOverallStatus(monitors) {
    if (monitors.length === 0) {
        return "operational";
    }

    const hasDownMonitor = monitors.some(
        (monitor) =>
            !monitor.ok && monitor.checked_at,
    );

    return hasDownMonitor
        ? "degraded"
        : "operational";
}

export {
    getStatus,
};