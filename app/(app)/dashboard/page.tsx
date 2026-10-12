import { Suspense } from 'react';
import { DashboardStub } from '@/components/features/DashboardStub';

export default function DashboardPage() {
	return (
		<Suspense fallback={null}>
			<DashboardStub />
		</Suspense>
	);
}
