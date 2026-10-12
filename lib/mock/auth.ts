// Доступ к мок-API по Bearer-токену MOCK_API_TOKEN. Сессия Auth.js здесь не используется:
// ходит worker, а не пользователь.

import { createHash, timingSafeEqual } from 'node:crypto';
import { directError } from '@/lib/mock/dto';

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;
const UNAUTHORIZED_MESSAGE = 'Нужен заголовок Authorization: Bearer <токен>';

function sha256(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

/** Токен не задан или пуст → доступ закрыт для всех. */
export function isAuthorized(authorization: string | null, token: string | undefined): boolean {
	if (!token || !authorization) return false;

	const match = BEARER_PATTERN.exec(authorization);
	if (!match?.[1]) return false;

	// Сравниваем хеши: одинаковая длина, время не зависит от места расхождения
	return timingSafeEqual(sha256(match[1]), sha256(token));
}

/** `null` — токен верный; иначе готовый ответ 401. */
export function requireMockToken(request: Request): Response | null {
	if (isAuthorized(request.headers.get('authorization'), process.env.MOCK_API_TOKEN)) return null;
	return directError(401, UNAUTHORIZED_MESSAGE);
}
