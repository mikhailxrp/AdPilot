// Выбор LLMClient по env: `LLM_CLIENT=yandex` (по умолчанию) — настоящая модель, `fake` — без сети и ключей.

import { z } from 'zod';
import { FakeLLMClient } from '@/lib/llm/fake-client';
import type { LLMClient } from '@/lib/llm/types';
import { YandexLLMClient } from '@/lib/llm/yandex-client';

/** Ответ `fake` из env: всегда «держим». Ответ по решению `rules` — таски 3 и 7. */
export const FAKE_HOLD_ANSWER = JSON.stringify({ action: 'HOLD', value: null, reason: 'fake: держим' });

const clientKindSchema = z.enum(['yandex', 'fake'], 'LLM_CLIENT должен быть yandex или fake').default('yandex');

const yandexEnvSchema = z.object({
	YANDEX_API_KEY: z.string('Не задан YANDEX_API_KEY').min(1, 'Не задан YANDEX_API_KEY'),
	YANDEX_FOLDER_ID: z.string('Не задан YANDEX_FOLDER_ID').min(1, 'Не задан YANDEX_FOLDER_ID'),
	LLM_MODEL_URI: z.string().optional(),
});

/** URI модели по умолчанию в каталоге. */
export function defaultModelUri(folderId: string): string {
	return `gpt://${folderId}/yandexgpt/latest`;
}

function fail(error: z.ZodError): never {
	throw new Error(`Конфигурация LLMClient: ${error.issues.map(({ message }) => message).join('; ')}`);
}

export function createLLMClientFromEnv(env: Record<string, string | undefined> = process.env): LLMClient {
	const kind = clientKindSchema.safeParse(env.LLM_CLIENT || undefined);
	if (!kind.success) fail(kind.error);
	if (kind.data === 'fake') return new FakeLLMClient(() => FAKE_HOLD_ANSWER);

	const parsed = yandexEnvSchema.safeParse(env);
	if (!parsed.success) fail(parsed.error);
	const { YANDEX_API_KEY, YANDEX_FOLDER_ID, LLM_MODEL_URI } = parsed.data;
	return new YandexLLMClient({
		apiKey: YANDEX_API_KEY,
		folderId: YANDEX_FOLDER_ID,
		modelUri: LLM_MODEL_URI || defaultModelUri(YANDEX_FOLDER_ID),
	});
}
