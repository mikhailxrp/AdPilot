export default function SimulatorLoading() {
	return (
		<div className="space-y-4" role="status" aria-label="Загрузка симулятора">
			<div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
			<div className="h-10 w-full max-w-md animate-pulse rounded-md bg-muted" />
			<div className="h-48 w-full animate-pulse rounded-md bg-muted" />
		</div>
	);
}
