import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, SupplierStatement } from '@/lib/db';

const STATEMENTS_FILE = 'supplier-statements.json';

// POST /api/supplier-statements/[id]/supplier-confirm - 供应商确认并录入金额
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { supplierAmount, supplierItems } = body;

    const statements = await readJsonFile<SupplierStatement>(STATEMENTS_FILE);
    const index = statements.findIndex(s => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '对账单不存在' }, { status: 404 });
    }

    const statement = statements[index];

    if (statement.status !== 'pending_supplier_confirm' && statement.status !== 'disputed') {
      return NextResponse.json({ error: '对账单状态不正确，只有"待供应商确认"或"有争议"状态可以操作' }, { status: 400 });
    }

    // 供应商录入金额和明细并确认
    statement.supplierAmount = supplierAmount;
    (statement as any).supplierItems = supplierItems || [];
    statement.differenceAmount = supplierAmount - statement.netAmount;
    statement.supplierConfirmed = true;
    statement.supplierConfirmedAt = now();
    statement.status = 'pending_buyer_confirm';
    statement.updatedAt = now();

    statements[index] = statement;
    await writeJsonFile(STATEMENTS_FILE, statements);

    return NextResponse.json(statement);
  } catch (error) {
    console.error('供应商确认失败:', error);
    return NextResponse.json({ error: '供应商确认失败' }, { status: 500 });
  }
}
