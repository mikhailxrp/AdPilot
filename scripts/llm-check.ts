// Ручная проверка настоящей модели Yandex AI Studio: `npm run llm:check [modelUri] [json_schema|json_object|text]`.
// Нужны YANDEX_API_KEY и YANDEX_FOLDER_ID в .env. Не для CI — каждый запуск тратит токены.

import 'dotenv/config';
import { z } from 'zod';
import { defaultModelUri } from '@/lib/llm/client-from-env';
import { LLMClientError } from '@/lib/llm/types';
import { YandexLLMClient, type LLMResponseFormat } from '@/lib/llm/yandex-client';

const RESPONSE_FORMATS = ['json_schema', 'json_object', 'text'] as const satisfies readonly LLMResponseFormat[];

const checkAnswerSchema = z.object({
	action: z.enum(['HOLD', 'LOWER_BID', 'RAISE_BID']),
	reason: z.string().min(1),
});

const usageSchema = z.object({ usage: z.unknown() });

const SYSTEM_PROMPT = 'Ты ассистент рекламного агента. Отвечай только JSON-объектом вида {"action": "...", "reason": "..."}.';
const USER_PROMPT =
	'Кампания: CPO за окно 1 500 ₽, цель 1 000 ₽, кликов 40. Выбери action из HOLD, LOWER_BID, RAISE_BID и объясни в reason одним предложением.';

function parseAnswer(content: string): string {
	try {
		const parsed = checkAnswerSchema.safeParse(JSON.parse(content));
		return parsed.success ? `да: ${JSON.stringify(parsed.data)}` : `нет: ${parsed.error.issues[0]?.message ?? 'схема'}`;
	} catch {
		return 'нет: ответ не JSON';
	}
}

function readUsage(raw: string): string {
	try {
		const parsed = usageSchema.safeParse(JSON.parse(raw));
		return parsed.success ? JSON.stringify(parsed.data.usage) : '—';
	} catch {
		return '—';
	}
}

async function main(): Promise<void> {
	const apiKey = process.env.YANDEX_API_KEY;
	const folderId = process.env.YANDEX_FOLDER_ID;
	if (!apiKey || !folderId) throw new Error('Задай YANDEX_API_KEY и YANDEX_FOLDER_ID в .env');

	const [modelArg, formatArg] = process.argv.slice(2);
	const modelUri = modelArg || process.env.LLM_MODEL_URI || defaultModelUri(folderId);
	const format = RESPONSE_FORMATS.find((item) => item === formatArg) ?? 'json_schema';

	const client = new YandexLLMClient({ apiKey, folderId, modelUri, responseFormat: format });
	console.log(`Модель: ${modelUri}\nРежим:  ${format}`);

	const startedAt = performance.now();
	const { content, raw } = await client.complete({
		system: SYSTEM_PROMPT,
		user: USER_PROMPT,
		jsonSchema: { name: 'check_decision', schema: z.toJSONSchema(checkAnswerSchema) },
	});
	const elapsedMs = Math.round(performance.now() - startedAt);

	console.log(`Время:  ${elapsedMs} мс`);
	console.log(`Usage:  ${readUsage(raw)}`);
	console.log(`Ответ:  ${content}`);
	console.log(`Схема:  ${parseAnswer(content)}`);
}

main().catch((error: unknown) => {
	if (error instanceof LLMClientError) console.error(`Ошибка ${error.code}: ${error.message}`);
	else if (error instanceof Error) console.error(`llm:check: ${error.message}`);
	else console.error('llm:check упал:', error);
	process.exitCode = 1;
});
