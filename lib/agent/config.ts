// Чтение конфига агента из БД. Строка одна (AGENT_CONFIG_ID), её создаёт seed.

import { db } from '@/lib/db';
import {
	AGENT_CONFIG_ID,
	agentConfigSchema,
	type AgentConfigBaseInput,
	type AgentConfigInput,
} from '@/lib/validations/agent-config';

export async function getAgentConfig(): Promise<AgentConfigInput> {
	const row = await db.agentConfig.findUnique({ where: { id: AGENT_CONFIG_ID } });
	if (!row) {
		throw new Error('Конфиг агента не найден — запустите seed (npx prisma db seed)');
	}
	return agentConfigSchema.parse(row);
}

/** Перезаписывает поля формы /settings; параметры LLM не трогает — их нет во входе. Вход проверен схемой формы. */
export async function updateAgentConfig(input: AgentConfigBaseInput): Promise<AgentConfigInput> {
	const row = await db.agentConfig.update({ where: { id: AGENT_CONFIG_ID }, data: input });
	return agentConfigSchema.parse(row);
}
