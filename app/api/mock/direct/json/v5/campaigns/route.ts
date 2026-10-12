import { CampaignState } from '@/generated/prisma/client';
import { toDirectCampaign } from '@/lib/mock/dto';
import { handleMockRequest } from '@/lib/mock/handler';
import { addCampaign, listCampaigns, setState, updateBudget } from '@/lib/mock/service';
import { campaignsRequestSchema, type CampaignsRequest } from '@/lib/validations/mock';

async function execute(request: CampaignsRequest): Promise<unknown> {
	switch (request.method) {
		case 'add': {
			const { id } = await addCampaign(request.params);
			return { Id: id };
		}
		case 'get': {
			const campaigns = await listCampaigns();
			return { Campaigns: campaigns.map(toDirectCampaign) };
		}
		case 'update': {
			const { id } = await updateBudget(request.params.CampaignId, request.params.DailyBudget);
			return { Id: id };
		}
		case 'suspend': {
			const { id } = await setState(request.params.CampaignId, CampaignState.SUSPENDED);
			return { Id: id };
		}
		case 'resume': {
			const { id } = await setState(request.params.CampaignId, CampaignState.ON);
			return { Id: id };
		}
	}
}

export function POST(request: Request): Promise<Response> {
	return handleMockRequest(request, campaignsRequestSchema, execute);
}
