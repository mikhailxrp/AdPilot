// Версии системного промпта LLM: какой текст реально ушёл в модель. Чистые функции — без БД;
// запись версии в таблицу — prompt-versions-db.ts.

import { createHash } from 'node:crypto';
import { LLM_SYSTEM_PROMPT } from '@/lib/agent/engines/llm-prompt';
import type { AgentConfigInput } from '@/lib/validations/agent-config';

/** Текст промпта из конфига; `null` — встроенный. */
export function resolveSystemPrompt({ llmSystemPrompt }: Pick<AgentConfigInput, 'llmSystemPrompt'>): string {
	return llmSystemPrompt ?? LLM_SYSTEM_PROMPT;
}

/** Отпечаток текста: одинаковый текст — одна версия. */
export function promptSha256(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}
