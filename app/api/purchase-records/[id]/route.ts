import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, PurchaseRecord } from '@/lib/db';

const FILE_NAME = 'purchase-records.json';

// GET /api/purchase-records/[id] - 获取采购记录详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const records = await readJsonFile<PurchaseRecord>(FILE_NAME);
    const record = records.find(r => r.id === id);

    if (!record) {
      return NextResponse.json({ error: '采购记录不存在' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('获取采购记录详情失败:', error);
    return NextResponse.json({ error: '获取采购记录详情失败' }, { status: 500 });
  }
}

// PUT /api/purchase-records/[id] - 更新采购记录
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const records = await readJsonFile<PurchaseRecord>(FILE_NAME);
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '采购记录不存在' }, { status: 404 });
    }

    const record = records[index];
    
    // 已确认的记录不能修改
    if (record.status === 'confirmed' && body.status !== 'confirmed') {
      return NextResponse.json({ error: '已确认的记录不能修改' }, { status: 400 });
    }

    const updatedRecord: PurchaseRecord = {
      ...record,
      ...body,
      totalAmount: body.items?.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0) || record.totalAmount,
      updatedAt: now(),
    };

    records[index] = updatedRecord;
    await writeJsonFile(FILE_NAME, records);

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error('更新采购记录失败:', error);
    return NextResponse.json({ error: '更新采购记录失败' }, { status: 500 });
  }
}

// DELETE /api/purchase-records/[id] - 删除采购记录
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const records = await readJsonFile<PurchaseRecord>(FILE_NAME);
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '采购记录不存在' }, { status: 404 });
    }

    const record = records[index];
    
    // 已确认的记录不能删除
    if (record.status === 'confirmed') {
      return NextResponse.json({ error: '已确认的记录不能删除' }, { status: 400 });
    }

    records.splice(index, 1);
    await writeJsonFile(FILE_NAME, records);

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除采购记录失败:', error);
    return NextResponse.json({ error: '删除采购记录失败' }, { status: 500 });
  }
}
