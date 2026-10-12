// Вывод метрик для панели. Округление — только здесь.

export const NO_DATA = 'нет данных';

const KOPECKS_PER_RUBLE = 100;
const PERCENT_MAX_FRACTION_DIGITS = 2;

const rubFormatter = new Intl.NumberFormat('ru-RU', {
	style: 'currency',
	currency: 'RUB',
});

const percentFormatter = new Intl.NumberFormat('ru-RU', {
	style: 'percent',
	maximumFractionDigits: PERCENT_MAX_FRACTION_DIGITS,
});

export function formatRub(kopecks: number | null): string {
	if (kopecks === null) return NO_DATA;
	return rubFormatter.format(kopecks / KOPECKS_PER_RUBLE);
}

export function formatPercent(ratio: number | null): string {
	if (ratio === null) return NO_DATA;
	return percentFormatter.format(ratio);
}
