'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/actions/simulator';
import { requireAdmin } from '@/lib/access';
import { updateAgentConfig } from '@/lib/agent/config';
import type { AgentConfigInput } from '@/lib/validations/agent-config';
import { agentConfigFormSchema } from '@/lib/validations/agent-config-form';

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
