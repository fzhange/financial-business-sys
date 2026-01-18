import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, generateId, generateNo, now, PurchaseOrder } from '@/lib/db';

const FILE_NAME = 'purchase-orders.json';

// GET /api/purchase-orders - 获取采购单列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    let orders = await readJsonFile<PurchaseOrder>(FILE_NAME);

    if (supplierId) {
      orders = orders.filter(o => o.supplierId === supplierId);
    }
    if (type) {
      orders = orders.filter(o => o.type === type);
    }
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(orders);
  } catch (error) {
    console.error('获取采购单列表失败:', error);
    return NextResponse.json({ error: '获取采购单列表失败' }, { status: 500 });
  }
}

// POST /api/purchase-orders - 创建采购单
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orders = await readJsonFile<PurchaseOrder>(FILE_NAME);

    const newOrder: PurchaseOrder = {
      id: generateId(),
      orderNo: generateNo('PO'),
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      orderDate: body.orderDate || new Date().toISOString().split('T')[0],
      totalAmount: body.totalAmount,
      type: body.type || 'standard',
      paymentStatus: 'unpaid',
      paidAmount: 0,
      unpaidAmount: body.totalAmount,
      inboundStatus: 'pending',
      status: 'draft',
      items: body.items || [],
      remarks: body.remarks,
      createdAt: now(),
      updatedAt: now(),
    };

    orders.push(newOrder);
    await writeJsonFile(FILE_NAME, orders);

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error('创建采购单失败:', error);
    return NextResponse.json({ error: '创建采购单失败' }, { status: 500 });
  }
}
