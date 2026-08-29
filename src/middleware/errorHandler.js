import { ZodError } from "zod";

function errorHandler(error, req, res, next) {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof ZodError) {
        return res.status(400).json({
            error: "Validation failed",
            details: error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
        error: error.message || "Internal server error",
    });
}

export { errorHandler };