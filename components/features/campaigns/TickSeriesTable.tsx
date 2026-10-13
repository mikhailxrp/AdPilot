import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SeriesPoint } from '@/lib/campaigns/series';
import { formatRub } from '@/lib/metrics/format';

interface TickSeriesTableProps {
	points: SeriesPoint[];
	windowTicks: number;
}

export function TickSeriesTable({ points, windowTicks }: TickSeriesTableProps) {
	if (points.length === 0) {
		return (
			<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
				Тиков ещё не было. Сделайте тик на странице «Симулятор».
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Тик</TableHead>
					<TableHead className="text-right">Ставка</TableHead>
					<TableHead className="text-right">Расход</TableHead>
					<TableHead className="text-right">CPO за {windowTicks} тиков</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{points.map((point) => (
					<TableRow key={point.tick}>
						<TableCell>{point.tick}</TableCell>
						<TableCell className="text-right">{formatRub(point.bid)}</TableCell>
						<TableCell className="text-right">{formatRub(point.cost)}</TableCell>
						<TableCell className="text-right">{formatRub(point.windowCpo)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
