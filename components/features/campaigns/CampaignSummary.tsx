import { Badge } from '@/components/ui/badge';
import type { CampaignDetail } from '@/lib/campaigns/queries';
import { STATE_LABELS } from '@/lib/campaigns/state-labels';
import { formatPercent, formatRub } from '@/lib/metrics/format';

interface CampaignSummaryProps {
	campaign: Omit<CampaignDetail, 'ticks'>;
}

const countFormatter = new Intl.NumberFormat('ru-RU');

export function CampaignSummary({ campaign }: CampaignSummaryProps) {
	const { run, totals, metrics } = campaign;
	const items = [
		{ label: 'Ставка', value: formatRub(campaign.bid) },
		{ label: 'Бюджет/сутки', value: formatRub(campaign.dailyBudget) },
		{ label: 'Цель CPO', value: formatRub(campaign.targetCpo) },
		{ label: 'Расход', value: formatRub(totals.cost) },
		{ label: 'Заказы', value: countFormatter.format(totals.orders) },
		{ label: 'CPC', value: formatRub(metrics.cpc) },
		{ label: 'CTR', value: formatPercent(metrics.ctr) },
		{ label: 'CR', value: formatPercent(metrics.cr) },
		{ label: 'CPO', value: formatRub(metrics.cpo) },
	];

	return (
		<section aria-label="Сводка кампании" className="space-y-4">
			<div className="flex flex-wrap items-center gap-2 text-muted-foreground">
				<Badge variant="outline">{STATE_LABELS[campaign.state]}</Badge>
				{run.archived && <Badge variant="secondary">архив</Badge>}
				<span>
					Тик {run.currentTick} · seed {run.seed}
				</span>
			</div>
			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{items.map(({ label, value }) => (
					<div key={label} className="rounded-md border p-3">
						<dt className="text-sm text-muted-foreground">{label}</dt>
						<dd className="text-lg font-semibold">{value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
