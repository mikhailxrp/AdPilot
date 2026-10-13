import { describe, expect, it } from 'vitest';
import {
	agentConfigFormSchema,
	FRACTIONAL_KOPECKS_MESSAGE,
	toAgentConfigFormValues,
	type AgentConfigFormValues,
} from '@/lib/validations/agent-config-form';
import {
	AGENT_CONFIG_BOUNDS,
	agentConfigBaseSchema,
	agentConfigSchema,
	type AgentConfigInput,
} from '@/lib/validations/agent-config';

const VALID_VALUES: AgentConfigFormValues = {
	engine: 'LLM',
	dryRun: true,
	timerEnabled: false,
	tickIntervalSec: '60',
	minClicks: '30',
	maxStepPct: '20',
	maxDailyBudget: '10000,50',
	cooldownTicks: '3',
	cpoTolerancePct: '20',
	windowTicks: '16',
};

const INT_FIELDS = [
	'tickIntervalSec',
	'minClicks',
	'maxStepPct',
	'cooldownTicks',
	'cpoTolerancePct',
	'windowTicks',
] as const;

function parseWith(patch: Partial<Record<keyof AgentConfigFormValues, unknown>>) {
	return agentConfigFormSchema.safeParse({ ...VALID_VALUES, ...patch });
}

function firstMessage(patch: Partial<Record<keyof AgentConfigFormValues, unknown>>): string | undefined {
	const result = parseWith(patch);
	return result.success ? undefined : result.error.issues[0]?.message;
}

describe('agentConfigFormSchema', () => {
	it('валидные значения → конфиг, рубли → копейки', () => {
		const result = agentConfigFormSchema.parse(VALID_VALUES);

		expect(result).toEqual({
			engine: 'LLM',
			dryRun: true,
			timerEnabled: false,
			tickIntervalSec: 60,
			minClicks: 30,
			maxStepPct: 20,
			maxDailyBudget: 1_000_050,
			cooldownTicks: 3,
			cpoTolerancePct: 20,
			windowTicks: 16,
		});
	});

	it('рубли с точкой, без дробной части и с пробелами по краям', () => {
		expect(parseWith({ maxDailyBudget: '10000.5' }).data?.maxDailyBudget).toBe(1_000_050);
		expect(parseWith({ maxDailyBudget: '250' }).data?.maxDailyBudget).toBe(25_000);
		expect(parseWith({ maxDailyBudget: ' 0,01 ' }).data?.maxDailyBudget).toBe(1);
	});

	it.each(INT_FIELDS)('%s: границы проходят, за границами — ошибка с текстом', (field) => {
		const { min, max } = AGENT_CONFIG_BOUNDS[field];
		const message = `Целое число от ${min} до ${max}`;

		expect(parseWith({ [field]: String(min) }).data?.[field]).toBe(min);
		expect(parseWith({ [field]: String(max) }).data?.[field]).toBe(max);
		expect(firstMessage({ [field]: String(min - 1) })).toBe(message);
		expect(firstMessage({ [field]: String(max + 1) })).toBe(message);
	});

	it('лимит бюджета: 0,01 ₽ и 1 000 000 ₽ проходят, за границами — ошибка', () => {
		const { min, max } = AGENT_CONFIG_BOUNDS.maxDailyBudget;

		expect(parseWith({ maxDailyBudget: '0,01' }).data?.maxDailyBudget).toBe(min);
		expect(parseWith({ maxDailyBudget: '1000000' }).data?.maxDailyBudget).toBe(max);
		expect(firstMessage({ maxDailyBudget: '0' })).toMatch(/^Сумма от 0,01/);
		expect(firstMessage({ maxDailyBudget: '1000000,01' })).toMatch(/^Сумма от 0,01/);
	});

	it('дробные копейки — ошибка, а не округление', () => {
		expect(firstMessage({ maxDailyBudget: '1,005' })).toBe(FRACTIONAL_KOPECKS_MESSAGE);
		expect(firstMessage({ maxDailyBudget: '100.999' })).toBe(FRACTIONAL_KOPECKS_MESSAGE);
	});

	it.each(['', '   ', 'abc', '1e3', '-5', '1 000'])('лимит бюджета «%s» — ошибка', (value) => {
		expect(parseWith({ maxDailyBudget: value }).success).toBe(false);
	});

	it.each(['', 'abc', '2.5', '2,5', '1e1'])('целое поле «%s» — ошибка', (value) => {
		expect(firstMessage({ maxStepPct: value })).toBe('Целое число от 1 до 50');
	});

	it.each(['maxStepPct', 'dryRun', 'engine'] as const)('без поля %s — ошибка, а не значение по умолчанию', (field) => {
		expect(parseWith({ [field]: undefined }).success).toBe(false);
	});

	it('неизвестный движок и не boolean в переключателе — ошибка', () => {
		expect(firstMessage({ engine: 'MAGIC' })).toBe('Неизвестный движок агента');
		expect(firstMessage({ timerEnabled: 'true' })).toBe('Ожидается true или false');
	});
});

describe('toAgentConfigFormValues', () => {
	it('копейки → рубли строкой', () => {
		const defaults = agentConfigSchema.parse({});

		expect(toAgentConfigFormValues({ ...defaults, maxDailyBudget: 1_000_050 }).maxDailyBudget).toBe('10000,50');
		expect(toAgentConfigFormValues({ ...defaults, maxDailyBudget: 1 }).maxDailyBudget).toBe('0,01');
		expect(toAgentConfigFormValues({ ...defaults, maxDailyBudget: 100 }).maxDailyBudget).toBe('1');
	});

	it.each<[string, AgentConfigInput]>([
		['дефолты', agentConfigSchema.parse({})],
		['копейки и границы', { ...agentConfigSchema.parse({}), maxDailyBudget: 1_234_507, maxStepPct: 50, cooldownTicks: 0 }],
	])('%s: конфиг → форма → схема без потерь', (_name, config) => {
		expect(agentConfigFormSchema.parse(toAgentConfigFormValues(config))).toEqual(agentConfigBaseSchema.parse(config));
	});

	it('форма не отдаёт параметры LLM — updateAgentConfig их не затрёт', () => {
		const config = {
			...agentConfigSchema.parse({}),
			llmSystemPrompt: 'Свой',
			llmModelUri: 'gpt://f/m',
			llmTemperature: 0.5,
		};

		expect(Object.keys(agentConfigFormSchema.parse(toAgentConfigFormValues(config)))).not.toContain('llmSystemPrompt');
	});
});
