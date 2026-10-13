import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardTotals } from '@/lib/dashboard/summary';
import { formatRub } from '@/lib/metrics/format';

interface SummaryCardsProps {
	totals: DashboardTotals;
}

const countFormatter = new Intl.NumberFormat('ru-RU');

export function SummaryCards({ totals }: SummaryCardsProps) {
	const items = [
		{ label: 'Расход', value: formatRub(totals.cost) },
		{ label: 'Заказы', value: countFormatter.format(totals.orders) },
		{ label: 'Средний CPO', value: formatRub(totals.cpo) },
	];

	return (
		<section aria-label="Итоги прогона" className="grid gap-4 sm:grid-cols-3">
			{items.map(({ label, value }) => (
				<Card key={label}>
					<CardHeader>
						<CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">{value}</p>
					</CardContent>
				</Card>
			))}
		</section>
	);
}
