import { z } from 'zod';

export const PLACEHOLDER_SECRET = 'change-me';
export const AUTH_SECRET_MIN_LENGTH = 32;

const HTTPS_PREFIX = 'https://';

const NOT_SET_MESSAGE = 'не задан';

const secret = z
	.string({ error: NOT_SET_MESSAGE })
	.trim()
	.min(1, NOT_SET_MESSAGE)
	.refine((value) => !value.toLowerCase().includes(PLACEHOLDER_SECRET), `содержит «${PLACEHOLDER_SECRET}» из .env.example — замени на настоящее`);

/** Prod-окружение: секреты настоящие, публичный адрес по https. Сообщения не содержат значений. */
export const productionEnvSchema = z.object({
	AUTH_SECRET: secret.min(AUTH_SECRET_MIN_LENGTH, `короче ${AUTH_SECRET_MIN_LENGTH} символов (npx auth secret)`),
	ADMIN_PASSWORD: secret,
	POSTGRES_PASSWORD: secret,
	MOCK_API_TOKEN: secret,
	AUTH_URL: z
		.url({ error: (issue) => (issue.input === undefined ? NOT_SET_MESSAGE : 'не URL') })
		.refine((value) => value.startsWith(HTTPS_PREFIX), `должен начинаться с ${HTTPS_PREFIX}`),
});

export type ProductionEnv = z.infer<typeof productionEnvSchema>;
