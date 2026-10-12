import { handleMockRequest } from '@/lib/mock/handler';
import { setBid } from '@/lib/mock/service';
import { bidsRequestSchema, type BidsRequest } from '@/lib/validations/mock';

async function execute(request: BidsRequest): Promise<unknown> {
	const { id } = await setBid(request.params.CampaignId, request.params.Bid);
	return { CampaignId: id };
}

export function POST(request: Request): Promise<Response> {
	return handleMockRequest(request, bidsRequestSchema, execute);
}
