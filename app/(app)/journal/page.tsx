import { JournalFilters } from '@/components/features/journal/JournalFilters';
import { JournalPagination } from '@/components/features/journal/JournalPagination';
import { JournalTable } from '@/components/features/journal/JournalTable';
import { requireAdmin } from '@/lib/access';
import { getJournalPage, listJournalCampaigns } from '@/lib/agent/journal-queries';
import { parseJournalFilters, type RawSearchParams } from '@/lib/validations/journal';

interface JournalPageProps {
	searchParams: Promise<RawSearchParams>;
}

export default async function JournalPage({ searchParams }: JournalPageProps) {
	await requireAdmin();
	const { page: requestedPage, ...filters } = parseJournalFilters(await searchParams);
	const [journal, campaigns] = await Promise.all([
		getJournalPage({ ...filters, page: requestedPage }),
		listJournalCampaigns(),
	]);

	return (
		<section className="space-y-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-bold">Журнал решений</h1>
				<p className="text-muted-foreground">Что сделал агент, почему и на каких цифрах.</p>
			</div>
			{journal ? (
				<>
					<JournalFilters campaigns={campaigns} filters={filters} />
					<JournalTable rows={journal.rows} />
					<JournalPagination
						filters={filters}
						page={journal.page}
						pageCount={journal.pageCount}
						total={journal.total}
					/>
				</>
			) : (
				<p className="text-muted-foreground">Прогона нет — сбросьте симулятор с seed.</p>
			)}
		</section>
	);
}
