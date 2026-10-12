export default function JournalLoading() {
	return (
		<div className="space-y-4" role="status" aria-label="Загрузка журнала">
			<div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
			<div className="h-10 w-full max-w-xl animate-pulse rounded-md bg-muted" />
			<div className="h-64 w-full animate-pulse rounded-md bg-muted" />
		</div>
	);
}
