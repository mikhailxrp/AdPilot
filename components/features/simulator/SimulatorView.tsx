import { CampaignsTable } from '@/components/features/simulator/CampaignsTable';
import { EngineToggle } from '@/components/features/simulator/EngineToggle';
import { SimulatorControls } from '@/components/features/simulator/SimulatorControls';
import { requireAdmin } from '@/lib/access';
import { getAgentConfig } from '@/lib/agent/config';
import { getActiveRunView } from '@/lib/simulator/queries';

export async function SimulatorView() {
	await requireAdmin();
	const [run, config] = await Promise.all([getActiveRunView(), getAgentConfig()]);

	return (
		<section className="space-y-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-bold">Симулятор</h1>
				{run ? (
					<p className="text-muted-foreground">
						Тик {run.currentTick} · seed {run.seed}
					</p>
				) : (
					<p className="text-muted-foreground">Прогона нет — сбросьте симулятор с seed.</p>
				)}
			</div>
			<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
				<SimulatorControls hasRun={run !== null} timerEnabled={config.timerEnabled} />
				<EngineToggle engine={config.engine} />
			</div>
			{run && <CampaignsTable campaigns={run.campaigns} />}
		</section>
	);
}
