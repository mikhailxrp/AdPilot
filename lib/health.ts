export const HEALTH_TIMEOUT_MS = 3000;

export interface HealthResult {
	status: 'ok' | 'error';
}

/** Наружу — только ok / error; подробности ошибки остаются в логе контейнера. */
export async function checkHealth(ping: () => Promise<unknown>, timeoutMs: number = HEALTH_TIMEOUT_MS): Promise<HealthResult> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`health ping timed out after ${timeoutMs} ms`)), timeoutMs);
	});

	try {
		await Promise.race([ping(), timeout]);
		return { status: 'ok' };
	} catch (error) {
		console.error('health check failed:', error);
		return { status: 'error' };
	} finally {
		clearTimeout(timer);
	}
}
