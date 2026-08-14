import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username too long")
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export const placeBetSchema = z
  .object({
    selections: z
      .array(
        z.object({
          fixtureId: z.string().min(1),
          marketKey: z.enum(["h2h", "totals", "btts"]),
          selectionKey: z.string().min(1),
        }),
      )
      .min(1, "No selections"),
    stake: z.number().int().min(1, "Stake must be at least 1").max(100000),
    type: z.enum(["SINGLE", "ACCA", "SYSTEM"]),
    systemType: z.enum(["TRIXIE", "PATENT", "YANKEE", "LUCKY15"]).nullish(),
  })
  .refine((v) => v.type !== "SYSTEM" || !!v.systemType, {
    message: "systemType required for SYSTEM bets",
    path: ["systemType"],
  });

export const friendRequestSchema = z.object({
  username: z.string().min(1, "Username required"),
});

export type PlaceBetInput = z.infer<typeof placeBetSchema>;
