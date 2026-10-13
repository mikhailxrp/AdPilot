'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/actions/simulator';
import { requireAdmin } from '@/lib/access';
import { resetLlmSystemPrompt, updateAgentConfig, updateLlmSettings } from '@/lib/agent/config';
import { LLM_SYSTEM_PROMPT } from '@/lib/agent/engines/llm-prompt';
import { checkModel, type CheckModelResult } from '@/lib/llm/check-model';
import { createLLMClientFromEnv } from '@/lib/llm/client-from-env';
import type { AgentConfigInput } from '@/lib/validations/agent-config';
import { agentConfigFormSchema } from '@/lib/validations/agent-config-form';
import { checkModelSchema, createLlmSettingsFormSchema } from '@/lib/validations/llm-settings';

const UNEXPECTED_ERROR_MESSAGE = 'Не удалось сохранить настройки. Попробуйте ещё раз';

/** Страницы, которые читают конфиг: пороги, движок, таймер, допуск CPO и окно графиков. */
const CONFIG_PATHS = ['/settings', '/simulator', '/dashboard', '/campaigns'] as const;
const CAMPAIGN_PAGE_PATTERN = '/campaigns/[id]';

/** Принимает значения формы (строки, рубли) и проверяет их той же схемой, что и клиент. */
export async function updateAgentConfigAction(input: unknown): Promise<ActionResult<AgentConfigInput>> {
	const parsed = agentConfigFormSchema.safeParse(input);
	if (!parsed.success) {
		return { success: false, error: parsed.error.issues[0]?.message ?? UNEXPECTED_ERROR_MESSAGE };
	}

	await requireAdmin();

	try {
		const config = await updateAgentConfig(parsed.data);
		for (const path of CONFIG_PATHS) revalidatePath(path);
		revalidatePath(CAMPAIGN_PAGE_PATTERN, 'page');
		return { success: true, data: config };
	} catch (error) {
		console.error('updateAgentConfigAction failed:', error);
		return { success: false, error: UNEXPECTED_ERROR_MESSAGE };
	}
}

const LLM_SAVE_ERROR_MESSAGE = 'Не удалось сохранить настройки LLM. Попробуйте ещё раз';
const LLM_RESET_ERROR_MESSAGE = 'Не удалось вернуть промпт по умолчанию. Попробуйте ещё раз';
const CHECK_UNEXPECTED_MESSAGE = 'Не удалось проверить модель. Попробуйте ещё раз';

/** Параметры LLM из формы (строки): `null` в поле = «по умолчанию». Остальной конфиг не меняется. */
export async function updateLlmSettingsAction(input: unknown): Promise<ActionResult<AgentConfigInput>> {
	const parsed = createLlmSettingsFormSchema(LLM_SYSTEM_PROMPT).safeParse(input);
	if (!parsed.success) {
		return { success: false, error: parsed.error.issues[0]?.message ?? LLM_SAVE_ERROR_MESSAGE };
	}

	await requireAdmin();

	try {
		const config = await updateLlmSettings(parsed.data);
		revalidatePath('/settings');
		return { success: true, data: config };
	} catch (error) {
		console.error('updateLlmSettingsAction failed:', error);
		return { success: false, error: LLM_SAVE_ERROR_MESSAGE };
	}
}

/** «Вернуть по умолчанию»: сразу записывает `null` в промпт. */
export async function resetPromptAction(): Promise<ActionResult<AgentConfigInput>> {
	await requireAdmin();

	try {
		const config = await resetLlmSystemPrompt();
		revalidatePath('/settings');
		return { success: true, data: config };
	} catch (error) {
		console.error('resetPromptAction failed:', error);
		return { success: false, error: LLM_RESET_ERROR_MESSAGE };
	}
}

/** Один короткий запрос к модели с URI и температурой из формы. Ничего не сохраняет и не пишет в журнал. */
export async function checkModelAction(input: unknown): Promise<ActionResult<CheckModelResult>> {
	const parsed = checkModelSchema.safeParse(input);
	if (!parsed.success) {
		return { success: false, error: parsed.error.issues[0]?.message ?? CHECK_UNEXPECTED_MESSAGE };
	}

	await requireAdmin();

	try {
		const client = createLLMClientFromEnv(process.env, {
			modelUri: parsed.data.llmModelUri,
			temperature: parsed.data.llmTemperature,
		});
		return { success: true, data: await checkModel(client) };
	} catch (error) {
		// Не заданы ключи Yandex: createLLMClientFromEnv бросает с понятным текстом
		console.error('checkModelAction failed:', error);
		return { success: false, error: error instanceof Error ? error.message : CHECK_UNEXPECTED_MESSAGE };
	}
}
