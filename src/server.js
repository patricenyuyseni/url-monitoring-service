import app from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { startScheduler } from "./scheduler/monitorScheduler.js";

async function startServer() {
    try {
        await pool.query("SELECT 1");

        console.log("Database connected");

        const server = app.listen(config.PORT, () => {
            console.log(`Server running on port ${config.PORT}`);

            startScheduler();
        });

        server.on("error", (error) => {
            console.error("Server error:", error);
        });
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
}

startServer();