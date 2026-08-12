import "dotenv/config";

const config = {
    PORT: Number(process.env.PORT) || 3000,
    NODE_ENV: process.env.NODE_ENV || "development",
    DATABASE_URL: process.env.DATABASE_URL,
    CHECK_TIMEOUT_MS: Number(process.env.CHECK_TIMEOUT_MS) || 5000,
    SCHEDULER_INTERVAL_MS:
        Number(process.env.SCHEDULER_INTERVAL_MS) || 5000,
};

if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
}

export { config };