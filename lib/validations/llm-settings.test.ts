import { describe, expect, it } from 'vitest';
import {
	LLM_MODEL_URI_MESSAGE,
	LLM_PROMPT_EMPTY_MESSAGE,
	LLM_PROMPT_MAX_LENGTH,
	LLM_PROMPT_TOO_LONG_MESSAGE,
	LLM_TEMPERATURE_MESSAGE,
	checkModelSchema,
	createLlmSettingsFormSchema,
	toLlmSettingsFormValues,
} from '@/lib/validations/llm-settings';

const BUILT_IN = 'Встроенный промпт';
const schema = createLlmSettingsFormSchema(BUILT_IN);
const VALID = { llmModelUri: '', llmTemperature: '', llmSystemPrompt: 'Свой промпт' };

function firstMessage(input: unknown): string | undefined {
	const result = schema.safeParse(input);
	return result.success ? undefined : result.error.issues[0]?.message;
}

describe('createLlmSettingsFormSchema', () => {
	it('пустые URI и температура → null', () => {
		expect(schema.parse(VALID)).toEqual({ llmModelUri: null, llmTemperature: null, llmSystemPrompt: 'Свой промпт' });
	});

	it('валидный URI и температура с запятой', () => {
		const parsed = schema.parse({ ...VALID, llmModelUri: ' gpt://b1g/aliceai-llm/latest ', llmTemperature: '0,5' });

		expect(parsed.llmModelUri).toBe('gpt://b1g/aliceai-llm/latest');
		expect(parsed.llmTemperature).toBe(0.5);
	});

	it.each(['yandexgpt/latest', 'gpt://b1g', 'gpt://b1g/model name/latest', 'https://b1g/model'])(
		'URI «%s» отклоняется',
		(uri) => {
			expect(firstMessage({ ...VALID, llmModelUri: uri })).toBe(LLM_MODEL_URI_MESSAGE);
		},
	);

	it.each(['0', '1', '0.2'])('температура %s проходит', (value) => {
		expect(schema.safeParse({ ...VALID, llmTemperature: value }).success).toBe(true);
	});

	it.each(['-0,1', '1,1', 'abc'])('температура «%s» отклоняется', (value) => {
		expect(firstMessage({ ...VALID, llmTemperature: value })).toBe(LLM_TEMPERATURE_MESSAGE);
	});

	it.each(['', '   \n'])('пустой промпт «%s» отклоняется', (text) => {
		expect(firstMessage({ ...VALID, llmSystemPrompt: text })).toBe(LLM_PROMPT_EMPTY_MESSAGE);
	});

	it('промпт длиннее лимита отклоняется, ровно лимит проходит', () => {
		expect(firstMessage({ ...VALID, llmSystemPrompt: 'a'.repeat(LLM_PROMPT_MAX_LENGTH + 1) })).toBe(
			LLM_PROMPT_TOO_LONG_MESSAGE,
		);
		expect(schema.safeParse({ ...VALID, llmSystemPrompt: 'a'.repeat(LLM_PROMPT_MAX_LENGTH) }).success).toBe(true);
	});

	it('текст, равный встроенному, → null', () => {
		expect(schema.parse({ ...VALID, llmSystemPrompt: BUILT_IN }).llmSystemPrompt).toBeNull();
	});
});

describe('checkModelSchema', () => {
	it('разбирает URI и температуру, промпт не требует', () => {
		expect(checkModelSchema.parse({ llmModelUri: '', llmTemperature: '0.3' })).toEqual({
			llmModelUri: null,
			llmTemperature: 0.3,
		});
	});

	it('плохой URI отклоняется', () => {
		expect(checkModelSchema.safeParse({ llmModelUri: 'x', llmTemperature: '' }).success).toBe(false);
	});
});

describe('toLlmSettingsFormValues', () => {
	it('null → пустые поля и встроенный промпт', () => {
		expect(
			toLlmSettingsFormValues({ llmModelUri: null, llmTemperature: null, llmSystemPrompt: null }, BUILT_IN),
		).toEqual({ llmModelUri: '', llmTemperature: '', llmSystemPrompt: BUILT_IN });
	});

	it('значения → строки, температура с запятой', () => {
		expect(
			toLlmSettingsFormValues(
				{ llmModelUri: 'gpt://b1g/m/latest', llmTemperature: 0.5, llmSystemPrompt: 'Свой' },
				BUILT_IN,
			),
		).toEqual({ llmModelUri: 'gpt://b1g/m/latest', llmTemperature: '0,5', llmSystemPrompt: 'Свой' });
	});
});
