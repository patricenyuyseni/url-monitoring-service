import { createCheck } from "../services/checkService.js";
import {
    openIncident,
    resolveIncident,
} from "../services/incidentService.js";
import { checkUrl } from "./urlChecker.js";

async function runCheck(monitor) {
    const result = await checkUrl(monitor);

    const check = await createCheck({
        monitor_id: monitor.id,
        ok: result.ok,
        status_code: result.status_code,
        latency_ms: result.latency_ms,
        error: result.error,
    });

    if (result.ok) {
        await resolveIncident(monitor.id);
    } else {
        await openIncident(
            monitor.id,
            result.error,
        );
    }

    return check;
}

export { runCheck };