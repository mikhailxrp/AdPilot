import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CampaignCpoRow, CpoStatus } from '@/lib/dashboard/summary';
import { formatRub, NO_DATA } from '@/lib/metrics/format';

interface CampaignCpoTableProps {
	campaigns: CampaignCpoRow[];
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_VIEW: Record<CpoStatus, { label: string; variant: BadgeVariant }> = {
	WITHIN_TARGET: { label: 'в цели', variant: 'default' },
	WITHIN_TOLERANCE: { label: 'в допуске', variant: 'secondary' },
	OVER_TOLERANCE: { label: 'выше допуска', variant: 'destructive' },
	NO_DATA: { label: NO_DATA, variant: 'outline' },
};

export function CampaignCpoTable({ campaigns }: CampaignCpoTableProps) {
	return (
		<section aria-labelledby="dashboard-cpo" className="space-y-3">
			<h2 id="dashboard-cpo" className="text-lg font-semibold">
				CPO по кампаниям
			</h2>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Кампания</TableHead>
						<TableHead className="text-right">Цель CPO</TableHead>
						<TableHead className="text-right">Допустимый CPO</TableHead>
						<TableHead className="text-right">CPO за прогон</TableHead>
						<TableHead>Статус</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{campaigns.map(({ id, name, targetCpo, allowedCpo, cpo, status }) => (
						<TableRow key={id}>
							<TableCell className="font-medium">
								<Link
									href={`/campaigns/${id}`}
									className="inline-flex min-h-10 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
								>
									{name}
								</Link>
							</TableCell>
							<TableCell className="text-right">{formatRub(targetCpo)}</TableCell>
							<TableCell className="text-right">{formatRub(allowedCpo)}</TableCell>
							<TableCell className="text-right">{formatRub(cpo)}</TableCell>
							<TableCell>
								<Badge variant={STATUS_VIEW[status].variant}>{STATUS_VIEW[status].label}</Badge>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</section>
	);
}
