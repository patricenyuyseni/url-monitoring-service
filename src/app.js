import express from "express";
import monitorRoutes from "./routes/monitorRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
    });
});

app.use("/monitors", monitorRoutes);

app.use(errorHandler);

export default app;