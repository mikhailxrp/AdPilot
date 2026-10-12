import { describe, expect, it } from 'vitest';
import { AGENT_CONFIG_BOUNDS, agentConfigSchema, timerToggleSchema } from '@/lib/validations/agent-config';

const bounds = Object.entries(AGENT_CONFIG_BOUNDS);

describe('agentConfigSchema', () => {
	it('пустой объект — все дефолты, таймер и dry-run выключены', () => {
		expect(agentConfigSchema.parse({})).toEqual({
			engine: 'RULES',
			dryRun: false,
			timerEnabled: false,
			tickIntervalSec: 60,
			minClicks: 30,
			maxStepPct: 20,
			maxDailyBudget: 1_000_000,
			cooldownTicks: 3,
			cpoTolerancePct: 20,
			windowTicks: 16,
		});
	});

	it.each(bounds)('%s: принимает границы', (field, { min, max }) => {
		expect(agentConfigSchema.safeParse({ [field]: min }).success).toBe(true);
		expect(agentConfigSchema.safeParse({ [field]: max }).success).toBe(true);
	});

	it.each(bounds)('%s: отклоняет значения за границами', (field, { min, max }) => {
		expect(agentConfigSchema.safeParse({ [field]: min - 1 }).success).toBe(false);
		expect(agentConfigSchema.safeParse({ [field]: max + 1 }).success).toBe(false);
	});

	it.each(bounds)('%s: отклоняет дробное число', (field, { min }) => {
		expect(agentConfigSchema.safeParse({ [field]: min + 0.5 }).success).toBe(false);
	});

	it('принимает движок LLM', () => {
		expect(agentConfigSchema.parse({ engine: 'LLM' }).engine).toBe('LLM');
	});

	it.each(['GPT', 'rules', ''])('отклоняет неизвестный движок %j', (engine) => {
		expect(agentConfigSchema.safeParse({ engine }).success).toBe(false);
	});
});

describe('timerToggleSchema', () => {
	it.each([true, false])('принимает %s', (timerEnabled) => {
		expect(timerToggleSchema.parse({ timerEnabled })).toEqual({ timerEnabled });
	});

	it.each([{}, { timerEnabled: 'true' }, { timerEnabled: 1 }, { timerEnabled: null }])('отклоняет %j', (input) => {
		expect(timerToggleSchema.safeParse(input).success).toBe(false);
	});
});
