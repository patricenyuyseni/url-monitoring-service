import express from "express";
import {
    createMonitor,
    getMonitors,
    getMonitorById,
    updateMonitor,
    deleteMonitor,
} from "../services/monitorService.js";
import {
    createMonitorSchema,
    updateMonitorSchema,
    monitorListSchema,
    monitorIdSchema,
} from "../schemas/monitorSchema.js";
import { validate } from "../middleware/validate.js";
import { getMonitorUptime } from "../services/uptimeService.js";
import { uptimeQuerySchema } from "../schemas/uptimeSchema.js";
import { getIncidentsByMonitor } from "../services/incidentService.js";
import { incidentListSchema } from "../schemas/incidentSchema.js";

const router = express.Router();

router.post(
    "/",
    validate(createMonitorSchema),
    async (req, res, next) => {
        try {
            const monitor = await createMonitor(req.body);

            return res.status(201).json(monitor);
        } catch (error) {
            return next(error);
        }
    },
);

router.get("/", async (req, res, next) => {
    try {
        const pagination = monitorListSchema.parse(req.query);

        const result = await getMonitors(pagination);

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
});

router.get("/:id/uptime", async (req, res, next) => {
    try {
        const id = monitorIdSchema.parse(req.params.id);
        const query = uptimeQuerySchema.parse(req.query);

        const monitor = await getMonitorById(id);

        if (!monitor) {
            return res.status(404).json({
                error: "Monitor not found",
            });
        }

        const uptime = await getMonitorUptime(
            id,
            query.window,
        );

        return res.status(200).json({
            monitor_id: id,
            window: query.window,
            total_checks: uptime.total_checks,
            successful_checks: uptime.successful_checks,
            uptime_percentage: Number(
                uptime.uptime_percentage,
            ),
            average_latency_ms: uptime.average_latency_ms,
            p95_latency_ms: uptime.p95_latency_ms,
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/:id/incidents", async (req, res, next) => {
    try {
        const id = monitorIdSchema.parse(req.params.id);

        const monitor = await getMonitorById(id);

        if (!monitor) {
            return res.status(404).json({
                error: "Monitor not found",
            });
        }

        const pagination = incidentListSchema.parse(
            req.query,
        );

        const result = await getIncidentsByMonitor(
            id,
            pagination,
        );

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const id = monitorIdSchema.parse(req.params.id);

        const monitor = await getMonitorById(id);

        if (!monitor) {
            return res.status(404).json({
                error: "Monitor not found",
            });
        }

        return res.status(200).json(monitor);
    } catch (error) {
        return next(error);
    }
});

router.patch(
    "/:id",
    validate(updateMonitorSchema),
    async (req, res, next) => {
        try {
            const id = monitorIdSchema.parse(req.params.id);

            const monitor = await updateMonitor(
                id,
                req.body,
            );

            if (!monitor) {
                return res.status(404).json({
                    error: "Monitor not found",
                });
            }

            return res.status(204).send();
        } catch (error) {
            return next(error);
        }
    },
);

router.delete("/:id", async (req, res, next) => {
    try {
        const id = monitorIdSchema.parse(req.params.id);

        const monitor = await deleteMonitor(id);

        if (!monitor) {
            return res.status(404).json({
                error: "Monitor not found",
            });
        }

        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
});

export default router;