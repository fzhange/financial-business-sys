import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, PaymentRequest } from '@/lib/db';

const FILE_NAME = 'payment-requests.json';

// POST /api/payment-requests/[id]/approve - 审批请款单
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { approved, approvedBy, approvalRemarks } = body;

    const requests = await readJsonFile<PaymentRequest>(FILE_NAME);
    const index = requests.findIndex(r => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '请款单不存在' }, { status: 404 });
    }

    const req = requests[index];

    if (req.status !== 'pending_approval') {
      return NextResponse.json({ error: '只有待审批状态的请款单可以审批' }, { status: 400 });
    }

    req.status = approved ? 'approved' : 'rejected';
    req.approvedAt = now();
    req.approvedBy = approvedBy || '当前用户';
    req.approvalRemarks = approvalRemarks;
    req.updatedAt = now();

    requests[index] = req;
    await writeJsonFile(FILE_NAME, requests);

    return NextResponse.json(req);
  } catch (error) {
    console.error('审批请款单失败:', error);
    return NextResponse.json({ error: '审批请款单失败' }, { status: 500 });
  }
}
