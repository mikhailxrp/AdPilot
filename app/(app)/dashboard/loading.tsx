const CARD_SKELETONS = ['cost', 'orders', 'cpo'] as const;

export default function DashboardLoading() {
	return (
		<div className="space-y-4" role="status" aria-label="Загрузка дашборда">
			<div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
			<div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
			<div className="grid gap-4 sm:grid-cols-3">
				{CARD_SKELETONS.map((key) => (
					<div key={key} className="h-28 animate-pulse rounded-xl bg-muted" />
				))}
			</div>
			<div className="h-48 w-full animate-pulse rounded-md bg-muted" />
			<div className="h-64 w-full animate-pulse rounded-md bg-muted" />
		</div>
	);
}
