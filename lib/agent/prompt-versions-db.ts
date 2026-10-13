// Запись версии промпта в `prompt_versions`. Таблица только дополняется: тот же текст — та же строка.

import { db } from '@/lib/db';
import { promptSha256 } from '@/lib/agent/prompt-versions';

/** Находит или создаёт версию промпта по sha256 текста, возвращает её id. */
export async function ensurePromptVersion(text: string): Promise<string> {
	const sha256 = promptSha256(text);
	const { id } = await db.promptVersion.upsert({
		where: { sha256 },
		update: {},
		create: { sha256, text },
		select: { id: true },
	});
	return id;
}
