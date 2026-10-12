import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { buildJournalHref, type JournalFilters } from '@/lib/validations/journal';

interface JournalPaginationProps {
	filters: Omit<JournalFilters, 'page'>;
	page: number;
	pageCount: number;
	total: number;
}

export function JournalPagination({ filters, page, pageCount, total }: JournalPaginationProps) {
	if (pageCount <= 1) return null;

	return (
		<nav aria-label="Страницы журнала" className="flex items-center justify-between gap-3">
			<p className="text-sm text-muted-foreground">
				Страница {page} из {pageCount} · записей {total}
			</p>
			<div className="flex gap-2">
				{page > 1 && (
					<Link href={buildJournalHref(filters, page - 1)} className={buttonVariants({ variant: 'outline' })}>
						Назад
					</Link>
				)}
				{page < pageCount && (
					<Link href={buildJournalHref(filters, page + 1)} className={buttonVariants({ variant: 'outline' })}>
						Вперёд
					</Link>
				)}
			</div>
		</nav>
	);
}
