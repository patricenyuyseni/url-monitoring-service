import express from "express";
import { getUptime } from "../controllers/uptimeController.js";

const router = express.Router();

router.get("/:monitorId/uptime", getUptime);

export default router;
