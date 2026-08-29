import express from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";

import monitorRoutes from "./routes/monitorRoutes.js";
import checkRoutes from "./routes/checkRoutes.js";
import incidentRoutes from "./routes/incidentRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import uptimeRoutes from "./routes/uptimeRoutes.js";

import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDocument = YAML.load(
    path.join(__dirname, "../openapi.yaml"),
);

app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
    });
});

app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument),
);

app.use("/monitors", monitorRoutes);
app.use("/monitors", checkRoutes);
app.use("/monitors", uptimeRoutes);
app.use("/incidents", incidentRoutes);
app.use("/status", statusRoutes);

app.use(errorHandler);

export default app;