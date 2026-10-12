import { toDirectReportRow } from '@/lib/mock/dto';
import { handleMockRequest } from '@/lib/mock/handler';
import { getReport } from '@/lib/mock/service';
import { reportsRequestSchema, type ReportsRequest } from '@/lib/validations/mock';

async function execute(request: ReportsRequest): Promise<unknown> {
	const { currentTick, rows } = await getReport(request.params);
	return { CurrentTick: currentTick, Rows: rows.map(toDirectReportRow) };
}

export function POST(request: Request): Promise<Response> {
	return handleMockRequest(request, reportsRequestSchema, execute);
}
