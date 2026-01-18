import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, PaymentRequest } from '@/lib/db';

const FILE_NAME = 'payment-requests.json';

// POST /api/payment-requests/[id]/submit - 提交请款单
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { submittedBy } = body;

    const requests = await readJsonFile<PaymentRequest>(FILE_NAME);
    const index = requests.findIndex(r => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '请款单不存在' }, { status: 404 });
    }

    const req = requests[index];

    if (req.status !== 'draft') {
      return NextResponse.json({ error: '只有草稿状态的请款单可以提交' }, { status: 400 });
    }

    req.status = 'pending_approval';
    req.submittedAt = now();
    req.submittedBy = submittedBy || '当前用户';
    req.updatedAt = now();

    requests[index] = req;
    await writeJsonFile(FILE_NAME, requests);

    return NextResponse.json(req);
  } catch (error) {
    console.error('提交请款单失败:', error);
    return NextResponse.json({ error: '提交请款单失败' }, { status: 500 });
  }
}
