// Точка входа worker-контейнера: `npm run worker`. SIGTERM — доделать текущий тик и выйти.

import 'dotenv/config';
import { getAgentConfig } from '@/lib/agent/config';
import { runAgentTick } from '@/lib/agent/tick';
import { abortableSleep, runWorkerLoop } from '@/lib/agent/worker-loop';
import { db } from '@/lib/db';

async function main(): Promise<void> {
	const controller = new AbortController();
	const stop = (signalName: string) => {
		console.log(`${signalName}: завершаем worker после текущего тика`);
		controller.abort();
	};
	process.once('SIGTERM', () => stop('SIGTERM'));
	process.once('SIGINT', () => stop('SIGINT'));

	console.log('Worker запущен');
	try {
		await runWorkerLoop({
			getConfig: getAgentConfig,
			tick: runAgentTick,
			sleep: abortableSleep,
			signal: controller.signal,
		});
	} finally {
		await db.$disconnect();
	}
	console.log('Worker остановлен');
}

main().then(
	() => process.exit(0),
	(error) => {
		console.error('Worker упал:', error);
		process.exit(1);
	},
);
