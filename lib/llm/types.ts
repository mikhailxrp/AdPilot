// LLMClient — «телефон» к языковой модели. Реализации: YandexLLMClient (Yandex AI Studio) и FakeLLMClient (тесты, e2e).
// Клиент возвращает текст ответа как есть; разбор и проверка содержимого — на стороне движка.

export interface LLMRequest {
	system: string;
	user: string;
	/** JSON Schema ответа; если задана — клиент просит структурированный вывод. */
	jsonSchema?: LLMJsonSchema;
}

export interface LLMJsonSchema {
	name: string;
	schema: Record<string, unknown>;
}

export interface LLMResponse {
	/** Текст ответа модели (`choices[0].message.content`). */
	content: string;
	/** Тело ответа целиком — для `rawResponse` в журнале. */
	raw: string;
}

export interface LLMClient {
	complete(request: LLMRequest): Promise<LLMResponse>;
}

export type LLMErrorCode = 'unauthorized' | 'rate_limited' | 'bad_request' | 'unavailable' | 'invalid_response';

/** Ошибка вызова модели; `code` — что случилось, `message` — текст сервиса или описание сбоя. */
export class LLMClientError extends Error {
	constructor(
		readonly code: LLMErrorCode,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = 'LLMClientError';
	}
}
