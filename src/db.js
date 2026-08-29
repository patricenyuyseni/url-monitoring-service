import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

const pool = new Pool({
    connectionString: config.DATABASE_URL,
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
});

export { pool };