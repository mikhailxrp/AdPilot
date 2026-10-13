// Проверка модели: один короткий запрос, результат «доступна / код ошибки + время». В журнал и конфиг не пишет.

import { LLMClientError, type LLMClient, type LLMErrorCode } from '@/lib/llm/types';

const CHECK_SYSTEM_PROMPT = 'Ты проверка связи. Ответь одним словом: ok.';
const CHECK_USER_PROMPT = 'Проверка связи';

export type CheckModelCode = LLMErrorCode | 'unknown';

export type CheckModelResult =
	| { ok: true; ms: number }
	| { ok: false; code: CheckModelCode; message: string; ms: number };

export async function checkModel(client: LLMClient): Promise<CheckModelResult> {
	const startedAt = Date.now();
	try {
		await client.complete({ system: CHECK_SYSTEM_PROMPT, user: CHECK_USER_PROMPT });
		return { ok: true, ms: Date.now() - startedAt };
	} catch (error) {
		const ms = Date.now() - startedAt;
		if (error instanceof LLMClientError) return { ok: false, code: error.code, message: error.message, ms };
		console.error('checkModel failed:', error);
		return { ok: false, code: 'unknown', message: 'Неизвестная ошибка', ms };
	}
}
