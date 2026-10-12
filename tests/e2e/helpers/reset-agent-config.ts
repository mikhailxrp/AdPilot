// Сброс конфига агента к дефолтам Zod. Запускается через tsx из agent-config.ts:
// Playwright грузит тесты как CommonJS, а сгенерированный Prisma-клиент — ESM, напрямую не импортируется.

import 'dotenv/config';
import { db } from '@/lib/db';
import { AGENT_CONFIG_ID, agentConfigSchema } from '@/lib/validations/agent-config';

async function main(): Promise<void> {
	const defaults = agentConfigSchema.parse({});
	await db.agentConfig.upsert({
		where: { id: AGENT_CONFIG_ID },
		update: defaults,
		create: { id: AGENT_CONFIG_ID, ...defaults },
	});
}

main()
	.catch((error: unknown) => {
		console.error('Не удалось сбросить конфиг агента:', error);
		process.exitCode = 1;
	})
	.finally(() => db.$disconnect());
