// FakeLLMClient — заданные ответы без сети: Vitest и e2e (`LLM_CLIENT=fake`). Запоминает запросы для проверок.

import { LLMClientError, type LLMClient, type LLMRequest, type LLMResponse } from '@/lib/llm/types';

/** Ответчик: текст ответа модели или ошибка, которую клиент выбросит. */
export type FakeResponder = (request: LLMRequest) => string | LLMClientError;

export class FakeLLMClient implements LLMClient {
	readonly requests: LLMRequest[] = [];

	constructor(private readonly respond: FakeResponder) {}

	async complete(request: LLMRequest): Promise<LLMResponse> {
		this.requests.push(request);
		const answer = this.respond(request);
		if (answer instanceof LLMClientError) throw answer;
		return { content: answer, raw: answer };
	}
}
