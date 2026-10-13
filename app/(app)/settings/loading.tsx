const FIELD_SKELETONS = ['engine', 'dry-run', 'timer', 'interval', 'clicks', 'window', 'tolerance', 'cooldown'] as const;

export default function SettingsLoading() {
	return (
		<div className="space-y-4" role="status" aria-label="Загрузка настроек">
			<div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
			<div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
			<div className="grid max-w-3xl gap-6 sm:grid-cols-2">
				{FIELD_SKELETONS.map((key) => (
					<div key={key} className="h-16 animate-pulse rounded-md bg-muted" />
				))}
			</div>
		</div>
	);
}
