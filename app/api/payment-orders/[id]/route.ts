import { NextResponse } from 'next/server';
import { readJsonFile, PaymentOrder } from '@/lib/db';

const FILE_NAME = 'payment-orders.json';

// GET /api/payment-orders/[id] - 获取付款单详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orders = await readJsonFile<PaymentOrder>(FILE_NAME);
    const order = orders.find(o => o.id === id);

    if (!order) {
      return NextResponse.json({ error: '付款单不存在' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('获取付款单详情失败:', error);
    return NextResponse.json({ error: '获取付款单详情失败' }, { status: 500 });
  }
}
