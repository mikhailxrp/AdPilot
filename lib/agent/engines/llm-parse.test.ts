import { describe, expect, it } from 'vitest';
import { parseLlmDecision } from '@/lib/agent/engines/llm-parse';
import { FAKE_HOLD_ANSWER } from '@/lib/llm/client-from-env';

const FENCE = '```';

function answer(action: string, value: unknown, reason = 'причина'): string {
	return JSON.stringify({ action, value, reason });
}

describe('parseLlmDecision', () => {
	it('валидный LOWER_BID → Proposal в копейках', () => {
		expect(parseLlmDecision(answer('LOWER_BID', 16.5, 'CPO выше цели'))).toEqual({
			ok: true,
			proposal: { action: 'LOWER_BID', after: 1_650, reason: 'CPO выше цели' },
		});
	});

	it('RAISE_BUDGET: дробные копейки округляются', () => {
		expect(parseLlmDecision(answer('RAISE_BUDGET', 3600.006))).toMatchObject({
			ok: true,
			proposal: { action: 'RAISE_BUDGET', after: 360_001 },
		});
	});

	it('неизвестное действие → отказ', () => {
		const result = parseLlmDecision(answer('DELETE_CAMPAIGN', null));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('не по схеме');
	});

	it('RAISE_BID без value → отказ', () => {
		expect(parseLlmDecision(answer('RAISE_BID', null))).toEqual({
			ok: false,
			reason: 'Для RAISE_BID не указано новое значение',
		});
	});

	it('ответ без поля value → отказ', () => {
		expect(parseLlmDecision(JSON.stringify({ action: 'RAISE_BID', reason: 'x' })).ok).toBe(false);
	});

	it('value ≤ 0 → отказ', () => {
		expect(parseLlmDecision(answer('LOWER_BID', 0)).ok).toBe(false);
		expect(parseLlmDecision(answer('LOWER_BID', -5)).ok).toBe(false);
		expect(parseLlmDecision(answer('LOWER_BID', 0.001)).ok).toBe(false);
	});

	it('не-JSON → отказ', () => {
		expect(parseLlmDecision('Снизить ставку до 16 рублей')).toEqual({ ok: false, reason: 'Ответ модели не JSON' });
		expect(parseLlmDecision('').ok).toBe(false);
	});

	it('JSON, но не объект → отказ', () => {
		expect(parseLlmDecision('[1, 2]').ok).toBe(false);
		expect(parseLlmDecision('null').ok).toBe(false);
	});

	it('JSON в markdown-обёртке разбирается', () => {
		const wrapped = `${FENCE}json\n${answer('RAISE_BID', 24)}\n${FENCE}`;
		expect(parseLlmDecision(wrapped)).toMatchObject({ ok: true, proposal: { action: 'RAISE_BID', after: 2_400 } });
		expect(parseLlmDecision(`${FENCE}\n${answer('HOLD', null)}\n${FENCE}`).ok).toBe(true);
	});

	it('value у действия без изменения отбрасывается', () => {
		expect(parseLlmDecision(answer('HOLD', 20))).toMatchObject({ ok: true, proposal: { action: 'HOLD', after: null } });
		expect(parseLlmDecision(answer('PAUSE', 20))).toMatchObject({ ok: true, proposal: { action: 'PAUSE', after: null } });
	});

	it('ответ fake-клиента из env разбирается', () => {
		expect(parseLlmDecision(FAKE_HOLD_ANSWER)).toEqual({
			ok: true,
			proposal: { action: 'HOLD', after: null, reason: 'fake: держим' },
		});
	});
});
