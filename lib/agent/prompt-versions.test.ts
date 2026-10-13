import { describe, expect, it } from 'vitest';
import { LLM_SYSTEM_PROMPT } from '@/lib/agent/engines/llm-prompt';
import { promptSha256, resolveSystemPrompt } from '@/lib/agent/prompt-versions';

describe('promptSha256', () => {
	it('эталонный хеш', () => {
		expect(promptSha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});

	it('одинаковый текст — одинаковый хеш, разный — разный', () => {
		expect(promptSha256(LLM_SYSTEM_PROMPT)).toBe(promptSha256(LLM_SYSTEM_PROMPT));
		expect(promptSha256('a')).not.toBe(promptSha256('a '));
	});
});

describe('resolveSystemPrompt', () => {
	it('null → встроенный промпт', () => {
		expect(resolveSystemPrompt({ llmSystemPrompt: null })).toBe(LLM_SYSTEM_PROMPT);
	});

	it('свой текст возвращается как есть', () => {
		expect(resolveSystemPrompt({ llmSystemPrompt: 'Свой промпт' })).toBe('Свой промпт');
	});
});
