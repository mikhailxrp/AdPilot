import { TickChart } from '@/components/features/campaigns/TickChart';
import { allowedCpo } from '@/lib/agent/engines/rules';
import type { SeriesPoint } from '@/lib/campaigns/series';

interface CampaignChartsProps {
	points: SeriesPoint[];
	/** Копейки. */
	targetCpo: number;
	cpoTolerancePct: number;
	windowTicks: number;
}

export function CampaignCharts({ points, targetCpo, cpoTolerancePct, windowTicks }: CampaignChartsProps) {
	const hasCpo = points.some((point) => point.windowCpo !== null);

	return (
		<section aria-labelledby="campaign-charts" className="space-y-3">
			<h2 id="campaign-charts" className="text-lg font-semibold">
				Графики
			</h2>
			{points.length === 0 ? (
				<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
					Тиков ещё не было. Сделайте тик на странице «Симулятор».
				</p>
			) : (
				<div className="grid gap-4 lg:grid-cols-3">
					<TickChart title="Ставка" dataKey="bid" points={points} />
					<TickChart title="Расход" dataKey="cost" points={points} />
					<TickChart
						title={`CPO за ${windowTicks} тиков`}
						dataKey="windowCpo"
						points={points}
						references={[
							{ label: 'Цель CPO', value: targetCpo, tone: 'muted' },
							{
								label: `Допустимый CPO (+${cpoTolerancePct}%)`,
								value: allowedCpo(targetCpo, cpoTolerancePct),
								tone: 'danger',
							},
						]}
						note={hasCpo ? undefined : 'CPO появится после первого заказа в окне.'}
					/>
				</div>
			)}
		</section>
	);
}
