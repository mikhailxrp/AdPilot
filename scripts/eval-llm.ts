// Ручной прогон оценочных сценариев на настоящей модели: `npm run eval:llm`.
// Нужны YANDEX_API_KEY и YANDEX_FOLDER_ID в .env (или LLM_CLIENT=fake — без сети). Не для CI: каждый запуск тратит токены.

import 'dotenv/config';
import { createLlmEngine } from '@/lib/agent/engines/llm';
import { runEval, type EvalRow } from '@/lib/agent/eval/run-eval';
import { EVAL_CONFIG, EVAL_SCENARIOS } from '@/lib/agent/eval/scenarios';
import { createLLMClientFromEnv } from '@/lib/llm/client-from-env';
import { LLMClientError } from '@/lib/llm/types';
import { formatRub } from '@/lib/metrics/format';

const NO_ANSWER = 'нет ответа';

function formatAnswer({ action, after }: EvalRow): string {
	if (action === null) return NO_ANSWER;
	return after === null ? action : `${action} → ${formatRub(after)}`;
}

function printRow(row: EvalRow): void {
	console.log(`${row.passed ? '✓' : '✗'} ${row.scenarioId}: ${formatAnswer(row)} — ${row.passed ? 'допустимо' : 'недопустимо'}`);
	if (row.reason) console.log(`    причина: ${row.reason}`);
	if (row.missReason) console.log(`    промах:  ${row.missReason}`);
}

async function main(): Promise<void> {
	const engine = createLlmEngine(createLLMClientFromEnv());
	console.log(`Сценариев: ${EVAL_SCENARIOS.length}, модель: ${process.env.LLM_MODEL_URI || 'по умолчанию'}\n`);

	const report = await runEval(engine, EVAL_SCENARIOS, EVAL_CONFIG);
	report.rows.forEach(printRow);
	console.log(`\nИтого: ${report.passed} из ${report.total} (${report.scorePct}%)`);
}

main().catch((error: unknown) => {
	if (error instanceof LLMClientError) console.error(`Ошибка ${error.code}: ${error.message}`);
	else if (error instanceof Error) console.error(`eval:llm: ${error.message}`);
	else console.error('eval:llm упал:', error);
	process.exitCode = 1;
});
