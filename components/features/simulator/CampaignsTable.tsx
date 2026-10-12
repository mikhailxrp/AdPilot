import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPercent, formatRub } from '@/lib/metrics/format';
import type { CampaignRow } from '@/lib/simulator/queries';

interface CampaignsTableProps {
	campaigns: CampaignRow[];
}

const STATE_LABELS: Record<CampaignRow['state'], string> = {
	ON: 'Включена',
	SUSPENDED: 'Приостановлена',
};

const countFormatter = new Intl.NumberFormat('ru-RU');

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Кампания</TableHead>
					<TableHead>Состояние</TableHead>
					<TableHead className="text-right">Ставка</TableHead>
					<TableHead className="text-right">Бюджет/сутки</TableHead>
					<TableHead className="text-right">Цель CPO</TableHead>
					<TableHead className="text-right">Показы</TableHead>
					<TableHead className="text-right">Клики</TableHead>
					<TableHead className="text-right">Заказы</TableHead>
					<TableHead className="text-right">Расход</TableHead>
					<TableHead className="text-right">CPC</TableHead>
					<TableHead className="text-right">CPM</TableHead>
					<TableHead className="text-right">CTR</TableHead>
					<TableHead className="text-right">CR</TableHead>
					<TableHead className="text-right">CPO</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{campaigns.map(({ id, name, state, bid, dailyBudget, targetCpo, totals, metrics }) => (
					<TableRow key={id}>
						<TableCell className="font-medium">{name}</TableCell>
						<TableCell>{STATE_LABELS[state]}</TableCell>
						<TableCell className="text-right">{formatRub(bid)}</TableCell>
						<TableCell className="text-right">{formatRub(dailyBudget)}</TableCell>
						<TableCell className="text-right">{formatRub(targetCpo)}</TableCell>
						<TableCell className="text-right">{countFormatter.format(totals.impressions)}</TableCell>
						<TableCell className="text-right">{countFormatter.format(totals.clicks)}</TableCell>
						<TableCell className="text-right">{countFormatter.format(totals.orders)}</TableCell>
						<TableCell className="text-right">{formatRub(totals.cost)}</TableCell>
						<TableCell className="text-right">{formatRub(metrics.cpc)}</TableCell>
						<TableCell className="text-right">{formatRub(metrics.cpm)}</TableCell>
						<TableCell className="text-right">{formatPercent(metrics.ctr)}</TableCell>
						<TableCell className="text-right">{formatPercent(metrics.cr)}</TableCell>
						<TableCell className="text-right">{formatRub(metrics.cpo)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
