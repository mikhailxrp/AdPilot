import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATE_LABELS } from '@/lib/campaigns/state-labels';
import { formatPercent, formatRub } from '@/lib/metrics/format';
import type { CampaignRow } from '@/lib/simulator/queries';

interface CampaignsListProps {
	campaigns: CampaignRow[];
}

const countFormatter = new Intl.NumberFormat('ru-RU');

export function CampaignsList({ campaigns }: CampaignsListProps) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Кампания</TableHead>
					<TableHead>Состояние</TableHead>
					<TableHead className="text-right">Ставка</TableHead>
					<TableHead className="text-right">Бюджет/сутки</TableHead>
					<TableHead className="text-right">Цель CPO</TableHead>
					<TableHead className="text-right">Расход</TableHead>
					<TableHead className="text-right">Заказы</TableHead>
					<TableHead className="text-right">CPC</TableHead>
					<TableHead className="text-right">CTR</TableHead>
					<TableHead className="text-right">CR</TableHead>
					<TableHead className="text-right">CPO</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{campaigns.map(({ id, name, state, bid, dailyBudget, targetCpo, totals, metrics }) => (
					<TableRow key={id}>
						<TableCell className="font-medium">
							<Link
								href={`/campaigns/${id}`}
								className="inline-flex min-h-10 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
							>
								{name}
							</Link>
						</TableCell>
						<TableCell>{STATE_LABELS[state]}</TableCell>
						<TableCell className="text-right">{formatRub(bid)}</TableCell>
						<TableCell className="text-right">{formatRub(dailyBudget)}</TableCell>
						<TableCell className="text-right">{formatRub(targetCpo)}</TableCell>
						<TableCell className="text-right">{formatRub(totals.cost)}</TableCell>
						<TableCell className="text-right">{countFormatter.format(totals.orders)}</TableCell>
						<TableCell className="text-right">{formatRub(metrics.cpc)}</TableCell>
						<TableCell className="text-right">{formatPercent(metrics.ctr)}</TableCell>
						<TableCell className="text-right">{formatPercent(metrics.cr)}</TableCell>
						<TableCell className="text-right">{formatRub(metrics.cpo)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
