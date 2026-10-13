import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CampaignSummary } from '@/components/features/campaigns/CampaignSummary';
import { TickSeriesTable } from '@/components/features/campaigns/TickSeriesTable';
import { JournalTable } from '@/components/features/journal/JournalTable';
import { requireAdmin } from '@/lib/access';
import { getAgentConfig } from '@/lib/agent/config';
import { getCampaignJournal } from '@/lib/agent/journal-queries';
import { getCampaignDetail } from '@/lib/campaigns/queries';
import { buildCampaignSeries } from '@/lib/campaigns/series';

export default async function CampaignPage({ params }: PageProps<'/campaigns/[id]'>) {
	await requireAdmin();
	const { id } = await params;
	const [campaign, config, journal] = await Promise.all([
		getCampaignDetail(id),
		getAgentConfig(),
		getCampaignJournal(id),
	]);
	if (!campaign) notFound();

	const { ticks, ...summary } = campaign;
	const series = buildCampaignSeries(ticks, config.windowTicks, campaign.run.currentTick);

	return (
		<section className="space-y-8">
			<div className="space-y-4">
				<Link
					href="/campaigns"
					className="inline-flex min-h-10 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
				>
					← Все кампании
				</Link>
				<h1 className="text-2xl font-bold">{campaign.name}</h1>
				<CampaignSummary campaign={summary} />
			</div>

			<details className="space-y-3">
				<summary className="cursor-pointer text-lg font-semibold">Данные по тикам</summary>
				<div className="mt-3">
					<TickSeriesTable points={series} windowTicks={config.windowTicks} />
				</div>
			</details>

			<section aria-labelledby="campaign-journal" className="space-y-3">
				<div className="space-y-1">
					<h2 id="campaign-journal" className="text-lg font-semibold">
						Журнал кампании
					</h2>
					{journal.total > journal.rows.length && (
						<p className="text-sm text-muted-foreground">
							Показано {journal.rows.length} из {journal.total}, новые сверху.
						</p>
					)}
				</div>
				{journal.rows.length > 0 ? (
					<JournalTable rows={journal.rows} />
				) : (
					<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
						Решений ещё нет.
					</p>
				)}
			</section>
		</section>
	);
}
