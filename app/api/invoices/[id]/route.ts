import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, Invoice, AccountsPayable, InvoicePayableRelation } from '@/lib/db';

const FILE_NAME = 'invoices.json';
const PAYABLES_FILE = 'accounts-payable.json';
const RELATIONS_FILE = 'invoice-payable-relations.json';

// GET /api/invoices/[id] - 获取发票详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoices = await readJsonFile<Invoice>(FILE_NAME);
    const relations = await readJsonFile<InvoicePayableRelation>(RELATIONS_FILE);
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);

    const invoice = invoices.find(inv => inv.id === id);

    if (!invoice) {
      return NextResponse.json({ error: '发票不存在' }, { status: 404 });
    }

    // 获取关联的应付账款
    const invoiceRelations = relations.filter(r => r.invoiceId === id);
    const relatedPayables = invoiceRelations.map(r => {
      const payable = payables.find(p => p.id === r.payableId);
      return {
        ...r,
        payable,
      };
    });

    return NextResponse.json({
      ...invoice,
      relations: relatedPayables,
    });
  } catch (error) {
    console.error('获取发票详情失败:', error);
    return NextResponse.json({ error: '获取发票详情失败' }, { status: 500 });
  }
}

// PUT /api/invoices/[id] - 更新发票
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const invoices = await readJsonFile<Invoice>(FILE_NAME);
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '发票不存在' }, { status: 404 });
    }

    const updatedInvoice: Invoice = {
      ...invoices[index],
      ...body,
      updatedAt: now(),
    };

    invoices[index] = updatedInvoice;
    await writeJsonFile(FILE_NAME, invoices);

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('更新发票失败:', error);
    return NextResponse.json({ error: '更新发票失败' }, { status: 500 });
  }
}

// DELETE /api/invoices/[id] - 删除发票（仅不可用且未核销的发票可删除）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoices = await readJsonFile<Invoice>(FILE_NAME);
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
    const relations = await readJsonFile<InvoicePayableRelation>(RELATIONS_FILE);

    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '发票不存在' }, { status: 404 });
    }

    const invoice = invoices[index];
    
    // 已核销的发票不能删除
    if (invoice.verifiedAmount > 0) {
      return NextResponse.json({ error: '已有核销记录的发票不能删除' }, { status: 400 });
    }

    // 仅不可用的发票可以删除（按spec要求）
    if (invoice.usable) {
      return NextResponse.json({ error: '可用状态的发票不能删除，请先将其标记为不可用' }, { status: 400 });
    }

    // 删除关联关系并恢复应付账款的已开票金额
    const invoiceRelations = relations.filter(r => r.invoiceId === id);
    for (const relation of invoiceRelations) {
      const payableIndex = payables.findIndex(p => p.id === relation.payableId);
      if (payableIndex !== -1) {
        payables[payableIndex].invoicedAmount -= relation.allocatedAmount;
        payables[payableIndex].updatedAt = now();
      }
    }

    // 删除关联关系
    const updatedRelations = relations.filter(r => r.invoiceId !== id);

    // 删除发票
    invoices.splice(index, 1);

    // 保存数据
    await Promise.all([
      writeJsonFile(FILE_NAME, invoices),
      writeJsonFile(PAYABLES_FILE, payables),
      writeJsonFile(RELATIONS_FILE, updatedRelations),
    ]);

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除发票失败:', error);
    return NextResponse.json({ error: '删除发票失败' }, { status: 500 });
  }
}
