import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, generateId, generateNo, now, SupplierStatement, PurchaseRecord } from '@/lib/db';

const FILE_NAME = 'supplier-statements.json';
const PURCHASE_RECORDS_FILE = 'purchase-records.json';

// GET /api/supplier-statements - 获取对账单列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');

    let statements = await readJsonFile<SupplierStatement>(FILE_NAME);

    if (supplierId) {
      statements = statements.filter(s => s.supplierId === supplierId);
    }
    if (status) {
      statements = statements.filter(s => s.status === status);
    }

    statements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(statements);
  } catch (error) {
    console.error('获取对账单列表失败:', error);
    return NextResponse.json({ error: '获取对账单列表失败' }, { status: 500 });
  }
}

// POST /api/supplier-statements - 新增对账单
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const statements = await readJsonFile<SupplierStatement>(FILE_NAME);
    const purchaseRecords = await readJsonFile<PurchaseRecord>(PURCHASE_RECORDS_FILE);

    // 获取选中的采购记录
    const selectedRecords = purchaseRecords.filter(
      r => body.purchaseRecordIds.includes(r.id) && r.status === 'confirmed'
    );

    // 计算入库总额和退货总额
    const totalInboundAmount = selectedRecords
      .filter(r => r.type === 'inbound')
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const totalReturnAmount = selectedRecords
      .filter(r => r.type === 'return')
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const netAmount = totalInboundAmount - totalReturnAmount;

    const newStatement: SupplierStatement = {
      id: generateId(),
      statementNo: generateNo('DZ'),
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      purchaseRecordIds: body.purchaseRecordIds,
      totalInboundAmount,
      totalReturnAmount,
      netAmount,
      supplierAmount: body.supplierAmount || netAmount,
      differenceAmount: (body.supplierAmount || netAmount) - netAmount,
      status: 'draft',
      supplierConfirmed: false,
      buyerConfirmed: false,
      remarks: body.remarks,
      createdAt: now(),
      updatedAt: now(),
    };

    statements.push(newStatement);
    await writeJsonFile(FILE_NAME, statements);

    return NextResponse.json(newStatement, { status: 201 });
  } catch (error) {
    console.error('创建对账单失败:', error);
    return NextResponse.json({ error: '创建对账单失败' }, { status: 500 });
  }
}
