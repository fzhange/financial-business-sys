import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, generateId, generateNo, now, PurchaseRecord, PurchaseOrder } from '@/lib/db';

const FILE_NAME = 'purchase-records.json';
const PO_FILE = 'purchase-orders.json';

// GET /api/purchase-records - 获取采购记录列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    let records = await readJsonFile<PurchaseRecord>(FILE_NAME);

    // 筛选
    if (supplierId) {
      records = records.filter(r => r.supplierId === supplierId);
    }
    if (type) {
      records = records.filter(r => r.type === type);
    }
    if (status) {
      records = records.filter(r => r.status === status);
    }

    // 按创建时间倒序
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(records);
  } catch (error) {
    console.error('获取采购记录失败:', error);
    return NextResponse.json({ error: '获取采购记录失败' }, { status: 500 });
  }
}

// POST /api/purchase-records - 新增采购记录
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const records = await readJsonFile<PurchaseRecord>(FILE_NAME);
    const pos = await readJsonFile<PurchaseOrder>(PO_FILE);

    const prefix = body.type === 'inbound' ? 'RK' : 'TH';
    let totalAmount = body.items?.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0) || 0;
    
    // 退货记录金额为负值
    if (body.type === 'return') {
      totalAmount = -Math.abs(totalAmount);
    }

    const newRecord: PurchaseRecord = {
      id: generateId(),
      recordNo: generateNo(prefix),
      type: body.type,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      poNo: body.poNo,
      recordDate: body.recordDate,
      items: body.items || [],
      totalAmount: totalAmount,
      // 入库/退货完成即为"已确认"状态，可直接用于生成对账单
      status: 'confirmed',
      createdAt: now(),
      updatedAt: now(),
    };

    records.push(newRecord);

    // 更新采购单状态
    if (body.poNo) {
      const poIndex = pos.findIndex(p => p.orderNo === body.poNo);
      if (poIndex !== -1) {
        if (body.type === 'inbound') {
          pos[poIndex].inboundStatus = 'received';
          // 简便处理：收货后如果已经付过款，采购单就算完成了
          if (pos[poIndex].paymentStatus === 'paid') {
            pos[poIndex].status = 'completed';
          }
        }
        pos[poIndex].updatedAt = now();
      }
    }

    await Promise.all([
      writeJsonFile(FILE_NAME, records),
      writeJsonFile(PO_FILE, pos),
    ]);

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error) {
    console.error('创建采购记录失败:', error);
    return NextResponse.json({ error: '创建采购记录失败' }, { status: 500 });
  }
}
