import { z } from 'zod';
import { LLM_TEMPERATURE_BOUNDS, type AgentConfigInput } from '@/lib/validations/agent-config';

// Форма LLM на /settings: строки → параметры LLM для AgentConfig. Пустое поле — «по умолчанию» (`null`).
// Та же схема проверяет данные в Server Actions. Встроенный промпт передаётся параметром: на клиенте его
// приносит сервер, в actions — константа, поэтому схема не тянет в браузер лишние модули.

/** Максимальная длина системного промпта, символов. */
export const LLM_PROMPT_MAX_LENGTH = 20_000;

/** `gpt://<каталог>/<модель>[/версия]`, без пробелов. */
export const LLM_MODEL_URI_PATTERN = /^gpt:\/\/[^/\s]+\/[^/\s]+(\/[^/\s]+)?$/;

export const LLM_MODEL_URI_MESSAGE = 'Формат: gpt://<каталог>/<модель>/<версия>';
export const LLM_PROMPT_EMPTY_MESSAGE = 'Промпт не может быть пустым';
export const LLM_PROMPT_TOO_LONG_MESSAGE = `Не больше ${LLM_PROMPT_MAX_LENGTH} символов`;
export const LLM_TEMPERATURE_MESSAGE = `Число от ${LLM_TEMPERATURE_BOUNDS.min} до ${LLM_TEMPERATURE_BOUNDS.max}`;

const TEMPERATURE_PATTERN = /^\d+([.,]\d+)?$/;

export type LlmSettingsInput = Pick<AgentConfigInput, 'llmSystemPrompt' | 'llmModelUri' | 'llmTemperature'>;

const modelUriField = z
	.string(LLM_MODEL_URI_MESSAGE)
	.trim()
	.transform((value) => (value === '' ? null : value))
	.pipe(z.string().regex(LLM_MODEL_URI_PATTERN, LLM_MODEL_URI_MESSAGE).nullable());

const temperatureField = z
	.string(LLM_TEMPERATURE_MESSAGE)
	.trim()
	.transform((value) => (value === '' ? null : value))
	.pipe(
		z
			.string()
			.regex(TEMPERATURE_PATTERN, LLM_TEMPERATURE_MESSAGE)
			.transform((value) => Number(value.replace(',', '.')))
			.pipe(z.number().min(LLM_TEMPERATURE_BOUNDS.min, LLM_TEMPERATURE_MESSAGE).max(LLM_TEMPERATURE_BOUNDS.max, LLM_TEMPERATURE_MESSAGE))
			.nullable(),
	);

/** Схема формы. Текст, равный встроенному промпту, превращается в `null` — «встроенный», а не его копия. */
export function createLlmSettingsFormSchema(builtInPrompt: string) {
	return z.object({
		llmModelUri: modelUriField,
		llmTemperature: temperatureField,
		llmSystemPrompt: z
			.string(LLM_PROMPT_EMPTY_MESSAGE)
			.refine((text) => text.trim().length > 0, LLM_PROMPT_EMPTY_MESSAGE)
			.refine((text) => text.length <= LLM_PROMPT_MAX_LENGTH, LLM_PROMPT_TOO_LONG_MESSAGE)
			.transform((text) => (text === builtInPrompt ? null : text)),
	}) satisfies z.ZodType<LlmSettingsInput, unknown>;
}

export type LlmSettingsFormValues = z.input<ReturnType<typeof createLlmSettingsFormSchema>>;

/** Параметры проверки модели: URI и температура из формы, промпт не нужен. */
export const checkModelSchema = z.object({
	llmModelUri: modelUriField,
	llmTemperature: temperatureField,
});

/** Конфиг из БД → значения формы; `null` промпт показывается встроенным текстом. */
export function toLlmSettingsFormValues(config: LlmSettingsInput, builtInPrompt: string): LlmSettingsFormValues {
	return {
		llmModelUri: config.llmModelUri ?? '',
		llmTemperature: config.llmTemperature === null ? '' : String(config.llmTemperature).replace('.', ','),
		llmSystemPrompt: config.llmSystemPrompt ?? builtInPrompt,
	};
}
