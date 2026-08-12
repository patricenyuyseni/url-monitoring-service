import express from "express";
import { getMonitorById } from "../services/monitorService.js";
import { getChecks } from "../services/checkService.js";
import {
    checkListSchema,
    monitorIdSchema,
} from "../schemas/checkSchema.js";

const router = express.Router();

router.get("/:monitorId/checks", async (req, res, next) => {
    try {
        const monitorId = monitorIdSchema.parse(
            req.params.monitorId,
        );

        const pagination = checkListSchema.parse(
            req.query,
        );

        const monitor = await getMonitorById(monitorId);

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
});

export default router;