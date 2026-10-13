import type { CampaignState } from '@/generated/prisma/client';

/** Подписи состояния кампании для интерфейса (список и страница кампании). */
export const STATE_LABELS: Record<CampaignState, string> = {
	ON: 'Включена',
	SUSPENDED: 'Приостановлена',
};
