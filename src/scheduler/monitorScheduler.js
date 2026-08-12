import { getDueMonitors } from "../services/monitorService.js";
import { runCheck } from "../checker/checkRunner.js";
import { config } from "../config.js";

let schedulerRunning = false;

async function runSchedulerTick() {
    if (schedulerRunning) {
        return;
    }

    schedulerRunning = true;

    try {
        const monitors = await getDueMonitors();

        for (const monitor of monitors) {
            try {
                await runCheck(monitor);

                console.log(
                    `Monitor checked: ${monitor.name} (${monitor.id})`,
                );
            } catch (error) {
                console.error(
                    `Monitor check failed for ${monitor.id}:`,
                    error,
                );
            }
        }
    } catch (error) {
        console.error("Scheduler tick failed:", error);
    } finally {
        schedulerRunning = false;
    }
}

function startScheduler() {
    console.log(
        `Scheduler started. Interval: ${config.SCHEDULER_INTERVAL_MS}ms`,
    );

    runSchedulerTick();

    return setInterval(
        runSchedulerTick,
        config.SCHEDULER_INTERVAL_MS,
    );
}

export { startScheduler, runSchedulerTick };