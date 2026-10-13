import { AgentConfigForm } from '@/components/forms/AgentConfigForm';
import { LlmSettingsForm } from '@/components/forms/LlmSettingsForm';
import { requireAdmin } from '@/lib/access';
import { getAgentConfig } from '@/lib/agent/config';
import { LLM_SYSTEM_PROMPT } from '@/lib/agent/engines/llm-prompt';

export default async function SettingsPage() {
	await requireAdmin();
	const config = await getAgentConfig();

	return (
		<section className="space-y-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-bold">Настройки агента</h1>
				<p className="text-muted-foreground">Новые значения действуют со следующего тика.</p>
			</div>
			<AgentConfigForm config={config} />
			<LlmSettingsForm config={config} builtInPrompt={LLM_SYSTEM_PROMPT} />
		</section>
	);
}
