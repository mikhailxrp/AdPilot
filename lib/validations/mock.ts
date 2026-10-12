import { z } from 'zod';

/** Микроединиц в одной копейке: в Директе сумма × 1 000 000, у нас копейка = сотая рубля. */
export const MICRO = 10_000;
/** Предел `Int` в PostgreSQL: деньги хранятся в копейках в колонке `Int`. */
const KOPECKS_MAX = 2_147_483_647;
export const NAME_MAX_LENGTH = 255;

const MONEY_MESSAGE = `Сумма — целое положительное число микроединиц, кратное ${MICRO}`;

/** Сумма в микроединицах из запроса → копейки. */
const moneySchema = z
	.number(MONEY_MESSAGE)
	.int(MONEY_MESSAGE)
	.positive(MONEY_MESSAGE)
	.max(KOPECKS_MAX * MICRO, 'Сумма слишком большая')
	.refine((value) => value % MICRO === 0, MONEY_MESSAGE)
	.transform((value) => value / MICRO);

const idSchema = z.string('Нужен идентификатор кампании').trim().min(1, 'Нужен идентификатор кампании');
const tickSchema = z.number('Тик — целое число от 1').int('Тик — целое число от 1').min(1, 'Тик — целое число от 1');

const campaignIdParams = z.object({ CampaignId: idSchema });

const addParams = z.object({
	Name: z.string('Нужно название').trim().min(1, 'Нужно название').max(NAME_MAX_LENGTH, 'Название слишком длинное'),
	Bid: moneySchema,
	DailyBudget: moneySchema,
	TargetCpo: moneySchema,
});

const reportParams = z
	.object({
		CampaignIds: z.array(idSchema).min(1, 'Список кампаний не может быть пустым').optional(),
		FromTick: tickSchema.optional(),
		ToTick: tickSchema.optional(),
	})
	.refine(({ FromTick, ToTick }) => FromTick === undefined || ToTick === undefined || FromTick <= ToTick, {
		message: 'FromTick не может быть больше ToTick',
	});

export const campaignsRequestSchema = z.discriminatedUnion('method', [
	z.object({ method: z.literal('add'), params: addParams }),
	z.object({ method: z.literal('get'), params: z.object({}).optional() }),
	z.object({ method: z.literal('update'), params: campaignIdParams.extend({ DailyBudget: moneySchema }) }),
	z.object({ method: z.literal('suspend'), params: campaignIdParams }),
	z.object({ method: z.literal('resume'), params: campaignIdParams }),
]);

export const bidsRequestSchema = z.discriminatedUnion('method', [
	z.object({ method: z.literal('set'), params: campaignIdParams.extend({ Bid: moneySchema }) }),
]);

export const reportsRequestSchema = z.discriminatedUnion('method', [
	z.object({ method: z.literal('get'), params: reportParams.optional() }),
]);

export type CampaignsRequest = z.infer<typeof campaignsRequestSchema>;
export type BidsRequest = z.infer<typeof bidsRequestSchema>;
export type ReportsRequest = z.infer<typeof reportsRequestSchema>;
export type AddCampaignParams = z.infer<typeof addParams>;
export type ReportParams = z.infer<typeof reportParams>;
