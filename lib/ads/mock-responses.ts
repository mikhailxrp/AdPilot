// Zod-схемы ответов мока Директа. Ответ всегда проверяется: деньги приходят в микроединицах
// и переводятся в копейки; сумма, не кратная MICRO, — ошибка ответа, а не округление.

import { z } from 'zod';
import { MICRO } from '@/lib/validations/mock';

const countSchema = z.number().int().nonnegative();

const moneySchema = z
	.number()
	.int()
	.nonnegative()
	.refine((value) => value % MICRO === 0, `Сумма должна быть кратна ${MICRO}`)
	.transform((value) => value / MICRO);

const campaignSchema = z
	.object({
		Id: z.string().min(1),
		Name: z.string(),
		State: z.enum(['ON', 'SUSPENDED']),
		Bid: moneySchema,
		DailyBudget: moneySchema,
		TargetCpo: moneySchema,
	})
	.transform((campaign) => ({
		id: campaign.Id,
		name: campaign.Name,
		state: campaign.State,
		bid: campaign.Bid,
		dailyBudget: campaign.DailyBudget,
		targetCpo: campaign.TargetCpo,
	}));

const reportRowSchema = z
	.object({
		CampaignId: z.string().min(1),
		Tick: z.number().int().min(1),
		Impressions: countSchema,
		Clicks: countSchema,
		Conversions: countSchema,
		Cost: moneySchema,
		Bid: moneySchema,
	})
	.transform((row) => ({
		campaignId: row.CampaignId,
		tick: row.Tick,
		impressions: row.Impressions,
		clicks: row.Clicks,
		orders: row.Conversions,
		cost: row.Cost,
		bid: row.Bid,
	}));

function resultOf<T extends z.ZodType>(result: T) {
	return z.object({ result });
}

export const campaignsGetResponseSchema = resultOf(z.object({ Campaigns: z.array(campaignSchema) }));

export const reportsGetResponseSchema = resultOf(
	z
		.object({ CurrentTick: countSchema, Rows: z.array(reportRowSchema) })
		.transform(({ CurrentTick, Rows }) => ({ currentTick: CurrentTick, rows: Rows })),
);

/** Ответ мутации: `campaigns.*` возвращает `{ Id }`, `bids.set` — `{ CampaignId }`. */
export const campaignIdResponseSchema = resultOf(z.object({ Id: z.string().min(1) }));
export const bidsSetResponseSchema = resultOf(z.object({ CampaignId: z.string().min(1) }));

export const errorResponseSchema = z.object({
	error: z.object({ error_code: z.number().int(), error_string: z.string() }),
});
