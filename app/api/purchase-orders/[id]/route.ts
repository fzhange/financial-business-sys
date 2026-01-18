import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, PurchaseOrder } from '@/lib/db';

const FILE_NAME = 'purchase-orders.json';

// GET /api/purchase-orders/[id] - 获取采购单详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orders = await readJsonFile<PurchaseOrder>(FILE_NAME);
    const order = orders.find(o => o.id === id);

    if (!order) {
      return NextResponse.json({ error: '采购单不存在' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('获取采购单详情失败:', error);
    return NextResponse.json({ error: '获取采购单详情失败' }, { status: 500 });
  }
}

// PUT /api/purchase-orders/[id] - 更新采购单
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const orders = await readJsonFile<PurchaseOrder>(FILE_NAME);
    const index = orders.findIndex(o => o.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '采购单不存在' }, { status: 404 });
    }

    const updatedOrder: PurchaseOrder = {
      ...orders[index],
      ...body,
      updatedAt: now(),
    };

    orders[index] = updatedOrder;
    await writeJsonFile(FILE_NAME, orders);

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('更新采购单失败:', error);
    return NextResponse.json({ error: '更新采购单失败' }, { status: 500 });
  }
}

// DELETE /api/purchase-orders/[id] - 删除采购单
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orders = await readJsonFile<PurchaseOrder>(FILE_NAME);
    const index = orders.findIndex(o => o.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '采购单不存在' }, { status: 404 });
    }

    const order = orders[index];
    if (order.status !== 'draft') {
      return NextResponse.json({ error: '只能删除草稿状态的采购单' }, { status: 400 });
    }

    orders.splice(index, 1);
    await writeJsonFile(FILE_NAME, orders);

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除采购单失败:', error);
    return NextResponse.json({ error: '删除采购单失败' }, { status: 500 });
  }
}
