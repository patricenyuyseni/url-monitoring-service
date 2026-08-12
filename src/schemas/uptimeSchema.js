import { z } from "zod";

const uptimeQuerySchema = z.object({
    window: z
        .string()
        .regex(
            /^\d+(m|h|d)$/,
            "Window must use m, h, or d",
        )
        .default("24h"),
});

export { uptimeQuerySchema };