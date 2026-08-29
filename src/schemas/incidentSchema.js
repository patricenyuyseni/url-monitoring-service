import { z } from "zod";

const incidentListSchema = z.object({
    after: z.coerce.number().int().positive().optional(),

    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20),
});

export { incidentListSchema };