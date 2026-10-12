import { Suspense } from 'react';
import { AdminHeader } from '@/components/layouts/AdminHeader';

export default function AppLayout({ children }: LayoutProps<'/'>) {
	return (
		<div className="flex flex-1 flex-col">
			<header className="flex items-center justify-between gap-4 border-b px-4 py-3">
				<span className="font-heading text-lg">AdPilot</span>
				<Suspense fallback={null}>
					<AdminHeader />
				</Suspense>
			</header>
			<main className="flex-1 p-4">{children}</main>
		</div>
	);
}
