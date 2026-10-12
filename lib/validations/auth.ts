import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(PASSWORD_MIN_LENGTH),
});

export type LoginInput = z.infer<typeof loginSchema>;
