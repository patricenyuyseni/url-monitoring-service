import { z } from "zod";

const httpUrlSchema = z
    .string()
    .trim()
    .url()
    .refine(
        (value) => {
            const url = new URL(value);

            return (
                url.protocol === "http:" ||
                url.protocol === "https:"
            );
        },
        {
            message: "URL must use http or https",
        },
    );

const createMonitorSchema = z.object({
    name: z.string().trim().min(1).max(120),

    url: httpUrlSchema,

    interval_seconds: z
        .number()
        .int()
        .min(10)
        .max(3600)
        .optional()
        .default(60),

    expected_status: z
        .number()
        .int()
        .min(100)
        .max(599)
        .optional()
        .default(200),
});

const updateMonitorSchema = z
    .object({
        name: z.string().trim().min(1).max(120).optional(),

        url: httpUrlSchema.optional(),

        interval_seconds: z
            .number()
            .int()
            .min(10)
            .max(3600)
            .optional(),

        expected_status: z
            .number()
            .int()
            .min(100)
            .max(599)
            .optional(),

        is_active: z.boolean().optional(),
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one field must be provided",
        },
    );

const monitorListSchema = z.object({
    after: z.coerce.number().int().positive().optional(),

    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10),
});

const monitorIdSchema = z.coerce
    .number()
    .int()
    .positive();

export {
    createMonitorSchema,
    updateMonitorSchema,
    monitorListSchema,
    monitorIdSchema,
};