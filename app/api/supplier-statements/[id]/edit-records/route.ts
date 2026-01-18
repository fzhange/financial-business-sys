import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, SupplierStatement, PurchaseRecord } from '@/lib/db';

const STATEMENTS_FILE = 'supplier-statements.json';
const RECORDS_FILE = 'purchase-records.json';

// PUT /api/supplier-statements/[id]/edit-records - 修改对账单关联的采购记录
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { purchaseRecordIds } = body;

    const statements = await readJsonFile<SupplierStatement>(STATEMENTS_FILE);
    const index = statements.findIndex(s => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '对账单不存在' }, { status: 404 });
    }

    const statement = statements[index];

    // 只有争议状态或草稿状态可以修改
    if (statement.status !== 'disputed' && statement.status !== 'draft') {
      return NextResponse.json({ error: '当前状态不允许修改' }, { status: 400 });
    }

    // 获取采购记录重新计算金额
    const records = await readJsonFile<PurchaseRecord>(RECORDS_FILE);
    const selectedRecords = records.filter(r => purchaseRecordIds.includes(r.id));

    let totalPurchaseAmount = 0;
    let totalReturnAmount = 0;

    selectedRecords.forEach(record => {
      if (record.type === 'inbound') {
        totalPurchaseAmount += record.totalAmount;
      } else {
        totalReturnAmount += record.totalAmount;
      }
    });

    const netAmount = totalPurchaseAmount - totalReturnAmount;

    // 更新对账单
    statement.purchaseRecordIds = purchaseRecordIds;
    statement.totalPurchaseAmount = totalPurchaseAmount;
    statement.totalReturnAmount = totalReturnAmount;
    statement.netAmount = netAmount;
    statement.differenceAmount = (statement.supplierAmount ?? 0) - netAmount;
    
    // 修改后重置为草稿状态，需要重新发送给供应商确认
    statement.status = 'draft';
    statement.supplierConfirmed = false;
    statement.supplierConfirmedAt = undefined;
    statement.updatedAt = now();

    statements[index] = statement;
    await writeJsonFile(STATEMENTS_FILE, statements);

    return NextResponse.json(statement);
  } catch (error) {
    console.error('修改对账单失败:', error);
    return NextResponse.json({ error: '修改对账单失败' }, { status: 500 });
  }
}
