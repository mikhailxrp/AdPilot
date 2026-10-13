import { z } from 'zod';
import { KOPECKS_PER_RUBLE, rubToKopecks } from '@/lib/metrics/money';
import { formatRub } from '@/lib/metrics/format';
import {
	AGENT_CONFIG_BOUNDS,
	AGENT_ENGINES,
	type AgentConfigBaseInput,
	type AgentConfigInput,
} from '@/lib/validations/agent-config';

// Форма /settings поверх agentConfigSchema: числа вводятся строками, лимит бюджета — в рублях.
// Дефолтов нет: поле, которое не пришло, — ошибка, а не тихий сброс к значению по умолчанию.
// Та же схема проверяет данные в updateAgentConfigAction.

interface Bounds {
	min: number;
	max: number;
}

const INT_PATTERN = /^-?\d+$/;
const RUB_PATTERN = /^\d+([.,]\d+)?$/;
/** Больше двух знаков после разделителя — дробные копейки. */
const FRACTIONAL_KOPECKS_PATTERN = /[.,]\d{3,}$/;

const ENGINE_MESSAGE = 'Неизвестный движок агента';
const BOOLEAN_MESSAGE = 'Ожидается true или false';
export const FRACTIONAL_KOPECKS_MESSAGE = 'Не больше 2 знаков после запятой';

function intField({ min, max }: Bounds) {
	const message = `Целое число от ${min} до ${max}`;
	return z
		.string(message)
		.trim()
		.regex(INT_PATTERN, message)
		.transform(Number)
		.pipe(z.int(message).min(min, message).max(max, message));
}

/** Рубли строкой (`10000,50` или `10000.50`) → целые копейки в границах `bounds` (копейки). */
function rubField({ min, max }: Bounds) {
	const message = `Сумма от ${formatRub(min)} до ${formatRub(max)}`;
	return z
		.string(message)
		.trim()
		.regex(RUB_PATTERN, message)
		.refine((value) => !FRACTIONAL_KOPECKS_PATTERN.test(value), FRACTIONAL_KOPECKS_MESSAGE)
		.transform((value) => rubToKopecks(Number(value.replace(',', '.'))))
		.pipe(z.int(message).min(min, message).max(max, message));
}

export const agentConfigFormSchema = z.object({
	engine: z.enum(AGENT_ENGINES, ENGINE_MESSAGE),
	dryRun: z.boolean(BOOLEAN_MESSAGE),
	timerEnabled: z.boolean(BOOLEAN_MESSAGE),
	tickIntervalSec: intField(AGENT_CONFIG_BOUNDS.tickIntervalSec),
	minClicks: intField(AGENT_CONFIG_BOUNDS.minClicks),
	maxStepPct: intField(AGENT_CONFIG_BOUNDS.maxStepPct),
	maxDailyBudget: rubField(AGENT_CONFIG_BOUNDS.maxDailyBudget),
	cooldownTicks: intField(AGENT_CONFIG_BOUNDS.cooldownTicks),
	cpoTolerancePct: intField(AGENT_CONFIG_BOUNDS.cpoTolerancePct),
	windowTicks: intField(AGENT_CONFIG_BOUNDS.windowTicks),
}) satisfies z.ZodType<AgentConfigBaseInput, unknown>;

/** Значения формы: числа — строки, лимит бюджета — рубли. */
export type AgentConfigFormValues = z.input<typeof agentConfigFormSchema>;

const RUB_FRACTION_DIGITS = 2;

/** Копейки → рубли строкой без float: 1_000_050 → «10000,50», 100 → «1». */
function kopecksToRubInput(kopecks: number): string {
	const rubles = Math.floor(kopecks / KOPECKS_PER_RUBLE);
	const rest = kopecks % KOPECKS_PER_RUBLE;
	return rest === 0 ? String(rubles) : `${rubles},${String(rest).padStart(RUB_FRACTION_DIGITS, '0')}`;
}

/** Конфиг из БД → значения формы; схема формы возвращает из них тот же конфиг. */
export function toAgentConfigFormValues(config: AgentConfigInput): AgentConfigFormValues {
	return {
		engine: config.engine,
		dryRun: config.dryRun,
		timerEnabled: config.timerEnabled,
		tickIntervalSec: String(config.tickIntervalSec),
		minClicks: String(config.minClicks),
		maxStepPct: String(config.maxStepPct),
		maxDailyBudget: kopecksToRubInput(config.maxDailyBudget),
		cooldownTicks: String(config.cooldownTicks),
		cpoTolerancePct: String(config.cpoTolerancePct),
		windowTicks: String(config.windowTicks),
	};
}
