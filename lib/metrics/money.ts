// Перевод денег между копейками (внутри приложения) и рублями (промпт и ответ LLM).

export const KOPECKS_PER_RUBLE = 100;

export function kopecksToRub(kopecks: number): number {
	return kopecks / KOPECKS_PER_RUBLE;
}

/** Рубли → целые копейки; дробные копейки округляются. */
export function rubToKopecks(rub: number): number {
	return Math.round(rub * KOPECKS_PER_RUBLE);
}
