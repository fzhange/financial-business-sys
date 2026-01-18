import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, PaymentRequest } from '@/lib/db';

const FILE_NAME = 'payment-requests.json';

// GET /api/payment-requests/[id] - 获取请款单详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requests = await readJsonFile<PaymentRequest>(FILE_NAME);
    const req = requests.find(r => r.id === id);

    if (!req) {
      return NextResponse.json({ error: '请款单不存在' }, { status: 404 });
    }

    return NextResponse.json(req);
  } catch (error) {
    console.error('获取请款单详情失败:', error);
    return NextResponse.json({ error: '获取请款单详情失败' }, { status: 500 });
  }
}

// PUT /api/payment-requests/[id] - 更新请款单
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const requests = await readJsonFile<PaymentRequest>(FILE_NAME);
    const index = requests.findIndex(r => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '请款单不存在' }, { status: 404 });
    }

    const req = requests[index];
    
    // 只有草稿状态可以修改
    if (req.status !== 'draft' && !body.status) {
      return NextResponse.json({ error: '只有草稿状态的请款单可以修改' }, { status: 400 });
    }

    const updatedRequest: PaymentRequest = {
      ...req,
      ...body,
      unpaidAmount: (body.requestAmount || req.requestAmount) - req.paidAmount,
      updatedAt: now(),
    };

    requests[index] = updatedRequest;
    await writeJsonFile(FILE_NAME, requests);

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error('更新请款单失败:', error);
    return NextResponse.json({ error: '更新请款单失败' }, { status: 500 });
  }
}
