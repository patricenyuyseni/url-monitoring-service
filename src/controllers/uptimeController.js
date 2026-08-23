import { getMonitorById } from "../services/monitorService.js";
import { getMonitorUptime } from "../services/uptimeService.js";
import { uptimeQuerySchema } from "../schemas/uptimeSchema.js";

async function getUptime(req, res, next) {
    try {
        const monitorId = Number(req.params.monitorId);

        const monitor = await getMonitorById(monitorId);

        if (!monitor) {
            return res.status(404).json({
                error: "Monitor not found",
            });
        }

        const query = uptimeQuerySchema.parse(req.query);

        const uptime = await getMonitorUptime(
            monitorId,
            query.window,
        );

        return res.status(200).json({
            monitor_id: monitorId,
            window: query.window,
            ...uptime,
        });
    } catch (error) {
        return next(error);
    }
}

export { getUptime };
