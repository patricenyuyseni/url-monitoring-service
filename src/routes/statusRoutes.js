import express from "express";
import { getStatus } from "../services/statusService.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const status = await getStatus();

        return res.status(200).json(status);
    } catch (error) {
        return next(error);
    }
});

export default router;