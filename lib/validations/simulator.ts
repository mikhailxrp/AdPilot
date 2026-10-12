import { z } from 'zod';

/** Предел `Int` в PostgreSQL: seed хранится в колонке `Int`. */
export const SEED_MAX = 2_147_483_647;
export const DEFAULT_SEED = 42;

const SEED_MESSAGE = `Seed — целое число от 0 до ${SEED_MAX}`;

export const resetSchema = z.object({
	seed: z
		.union([z.string().trim().min(1, SEED_MESSAGE), z.number()])
		.transform((value) => (typeof value === 'number' ? value : Number(value)))
		.pipe(z.number(SEED_MESSAGE).int(SEED_MESSAGE).min(0, SEED_MESSAGE).max(SEED_MAX, SEED_MESSAGE)),
});

/** Значения формы: seed вводится строкой. */
export type ResetFormInput = z.input<typeof resetSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
