import express from "express";
import {
    getIncidents,
    getIncidentsByMonitor,
} from "../services/incidentService.js";
import { getMonitorById } from "../services/monitorService.js";
import { incidentListSchema } from "../schemas/incidentSchema.js";
import { monitorIdSchema } from "../schemas/monitorSchema.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const pagination = incidentListSchema.parse(
            req.query,
        );

        const result = await getIncidents(pagination);

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
});

router.get("/monitors/:id", async (req, res, next) => {
    try {
        const monitorId = monitorIdSchema.parse(
            req.params.id,
        );

        const monitor = await getMonitorById(monitorId);

        if (!monitor) {
            return res.status(404).json({
                error: "Monitor not found",
            });
        }

        const pagination = incidentListSchema.parse(
            req.query,
        );

        const result = await getIncidentsByMonitor(
            monitorId,
            pagination,
        );

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
});

export default router;