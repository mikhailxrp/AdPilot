import type { DecisionAction } from '@/lib/agent/types';

/** Подписи действий агента для интерфейса (журнал и его фильтры). */
export const ACTION_LABELS: Record<DecisionAction, string> = {
	WAIT_DATA: 'Ждёт данных',
	HOLD: 'Без изменений',
	LOWER_BID: 'Снижение ставки',
	RAISE_BID: 'Повышение ставки',
	RAISE_BUDGET: 'Повышение бюджета',
	PAUSE: 'Пауза',
};
