import { describe, expect, it } from 'vitest';
import { computeMetrics, cpc, type MetricsInput } from '@/lib/metrics/metrics';

const zero: MetricsInput = { impressions: 0, clicks: 0, orders: 0, cost: 0 };

describe('computeMetrics', () => {
	it('считает все метрики на ручном примере', () => {
		expect(computeMetrics({ impressions: 1000, clicks: 50, orders: 2, cost: 10_000 })).toEqual({
			cpc: 200,
			cpm: 10_000,
			ctr: 0.05,
			cr: 0.04,
			cpo: 5000,
		});
	});

	it('без показов CPM и CTR — null', () => {
		const metrics = computeMetrics({ ...zero, cost: 500 });
		expect(metrics.cpm).toBeNull();
		expect(metrics.ctr).toBeNull();
	});

	it('без кликов CPC и CR — null, CPM и CTR считаются', () => {
		const metrics = computeMetrics({ ...zero, impressions: 200, cost: 500 });
		expect(metrics.cpc).toBeNull();
		expect(metrics.cr).toBeNull();
		expect(metrics.cpm).toBe(2500);
		expect(metrics.ctr).toBe(0);
	});

	it('расход без заказов: CPO — null, остальные считаются', () => {
		expect(computeMetrics({ impressions: 1000, clicks: 20, orders: 0, cost: 4000 })).toEqual({
			cpc: 200,
			cpm: 4000,
			ctr: 0.02,
			cr: 0,
			cpo: null,
		});
	});

	it('всё по нулям — все метрики null', () => {
		expect(computeMetrics(zero)).toEqual({ cpc: null, cpm: null, ctr: null, cr: null, cpo: null });
	});
});

describe('cpc', () => {
	it('не округляет дробный результат', () => {
		expect(cpc({ cost: 10_000, clicks: 3 })).toBeCloseTo(3333.3333, 4);
	});
});
