// Advisory lock Postgres: кнопка (web) и таймер (worker) — разные процессы, общая у них только БД.
// Замок транзакционный: освобождается при коммите или обрыве соединения.

import { db } from '@/lib/db';
import type { TickLockResult } from '@/lib/agent/tick-core';

/** Произвольный, но фиксированный ключ замка тика. */
export const TICK_LOCK_KEY = 726_001;
/** Тик включает HTTP-запросы к моку — транзакция живёт дольше стандартных 5 с. */
export const TICK_LOCK_TIMEOUT_MS = 60_000;
const TICK_LOCK_MAX_WAIT_MS = 5_000;

/** Выполняет `fn` под замком; замок занят → `fn` не вызывается, ожидания нет. */
export async function withTickLock<T>(fn: () => Promise<T>): Promise<TickLockResult<T>> {
	return db.$transaction(
		async (tx) => {
			const rows = await tx.$queryRaw<{ locked: boolean }[]>`
				SELECT pg_try_advisory_xact_lock(${TICK_LOCK_KEY}::bigint) AS locked
			`;
			if (!rows[0]?.locked) return { acquired: false } as const;
			return { acquired: true, value: await fn() } as const;
		},
		{ timeout: TICK_LOCK_TIMEOUT_MS, maxWait: TICK_LOCK_MAX_WAIT_MS },
	);
}
