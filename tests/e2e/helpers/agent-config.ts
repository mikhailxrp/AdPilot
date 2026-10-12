// Сброс конфига агента к дефолтам перед e2e. Seed существующий конфиг не трогает (пороги админа),
// а сквозной сценарий фазы рассчитан на пороги по умолчанию.

import { execSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.join(__dirname, 'reset-agent-config.ts');

export function resetAgentConfig(): void {
	execSync(`npx tsx "${SCRIPT}"`, { stdio: 'inherit' });
}
