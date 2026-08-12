import express from "express";
import { getMonitorById } from "../services/monitorService.js";
import {
    getChecks,
    streamChecksCsv,
} from "../services/checkService.js";
import {
    checkListSchema,
    monitorIdSchema,
} from "../schemas/checkSchema.js";

const router = express.Router();

router.get(
    "/:monitorId/checks",
    async (req, res, next) => {
        try {
            const monitorId = monitorIdSchema.parse(
                req.params.monitorId,
            );

            const pagination = checkListSchema.parse(
                req.query,
            );

            const monitor = await getMonitorById(
                monitorId,
            );

            if (!monitor) {
                return res.status(404).json({
                    error: "Monitor not found",
                });
            }

            const result = await getChecks(
                monitorId,
                pagination,
            );

            return res.status(200).json(result);
        } catch (error) {
            return next(error);
        }
    },
);

router.get(
    "/:monitorId/checks.csv",
    async (req, res, next) => {
        try {
            const monitorId = monitorIdSchema.parse(
                req.params.monitorId,
            );

            const monitor = await getMonitorById(
                monitorId,
            );

            if (!monitor) {
                return res.status(404).json({
                    error: "Monitor not found",
                });
            }

            res.status(200);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="monitor-${monitorId}-checks.csv"`,
            );

            await streamChecksCsv(monitorId, res);
        } catch (error) {
            return next(error);
        }
    },
);

export default router;