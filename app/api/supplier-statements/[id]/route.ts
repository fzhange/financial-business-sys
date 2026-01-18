import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, SupplierStatement } from '@/lib/db';

const FILE_NAME = 'supplier-statements.json';

// GET /api/supplier-statements/[id] - 获取对账单详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const statements = await readJsonFile<SupplierStatement>(FILE_NAME);
    const statement = statements.find(s => s.id === id);

    if (!statement) {
      return NextResponse.json({ error: '对账单不存在' }, { status: 404 });
    }

    return NextResponse.json(statement);
  } catch (error) {
    console.error('获取对账单详情失败:', error);
    return NextResponse.json({ error: '获取对账单详情失败' }, { status: 500 });
  }
}

// PUT /api/supplier-statements/[id] - 更新对账单
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const statements = await readJsonFile<SupplierStatement>(FILE_NAME);
    const index = statements.findIndex(s => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '对账单不存在' }, { status: 404 });
    }

    const statement = statements[index];

    // 已确认的对账单不能修改
    if (statement.status === 'confirmed') {
      return NextResponse.json({ error: '已确认的对账单不能修改' }, { status: 400 });
    }

    const updatedStatement: SupplierStatement = {
      ...statement,
      ...body,
      differenceAmount: (body.supplierAmount || statement.supplierAmount) - statement.netAmount,
      updatedAt: now(),
    };

    statements[index] = updatedStatement;
    await writeJsonFile(FILE_NAME, statements);

    return NextResponse.json(updatedStatement);
  } catch (error) {
    console.error('更新对账单失败:', error);
    return NextResponse.json({ error: '更新对账单失败' }, { status: 500 });
  }
}
