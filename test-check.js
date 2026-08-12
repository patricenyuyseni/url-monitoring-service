import { getMonitorById } from "./src/services/monitorService.js";
import { runCheck } from "./src/checker/checkRunner.js";

const monitor = await getMonitorById(5);

if (!monitor) {
    throw new Error("Monitor not found");
}

const check = await runCheck(monitor);

console.log(check);

process.exit(0);