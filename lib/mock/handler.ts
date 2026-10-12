// Общий каркас Route Handler'ов мока: токен → JSON → Zod → выполнение → ответ.

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { requireMockToken } from '@/lib/mock/auth';
import { directError, directResult } from '@/lib/mock/dto';
import { MockApiError } from '@/lib/mock/service';

const SIMULATOR_PATH = '/simulator';
const INVALID_JSON_MESSAGE = 'Тело запроса должно быть JSON вида { "method": ..., "params": ... }';
const INTERNAL_ERROR_MESSAGE = 'Внутренняя ошибка мока';
const READ_METHOD = 'get';

function describeIssue(error: z.ZodError): string {
	const issue = error.issues[0];
	if (!issue) return INVALID_JSON_MESSAGE;

	const path = issue.path.join('.');
	return path ? `${path}: ${issue.message}` : issue.message;
}

export async function handleMockRequest<S extends z.ZodType<{ method: string }>>(
	request: Request,
	schema: S,
	execute: (data: z.output<S>) => Promise<unknown>,
): Promise<Response> {
	const unauthorized = requireMockToken(request);
	if (unauthorized) return unauthorized;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return directError(400, INVALID_JSON_MESSAGE);
	}

	const parsed = schema.safeParse(body);
	if (!parsed.success) return directError(400, describeIssue(parsed.error));

	try {
		const result = await execute(parsed.data);
		// Мутация меняет ставки и бюджеты, которые показывает /simulator
		if (parsed.data.method !== READ_METHOD) revalidatePath(SIMULATOR_PATH);
		return directResult(result);
	} catch (error) {
		if (error instanceof MockApiError) return directError(error.status, error.message);
		console.error('mock direct request failed:', error);
		return directError(500, INTERNAL_ERROR_MESSAGE);
	}
}
