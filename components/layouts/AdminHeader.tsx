import { LogoutButton } from '@/components/layouts/LogoutButton';
import { requireAdmin } from '@/lib/access';

// Читает сессию (запрос), поэтому рендерится внутри <Suspense> в layout.
export async function AdminHeader() {
	const admin = await requireAdmin();

	return (
		<div className="flex items-center gap-3">
			<span className="truncate text-sm text-muted-foreground">{admin.email}</span>
			<LogoutButton />
		</div>
	);
}
