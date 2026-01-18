import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, Invoice, AccountsPayable, InvoicePayableRelation } from '@/lib/db';

const INVOICES_FILE = 'invoices.json';
const PAYABLES_FILE = 'accounts-payable.json';
const RELATIONS_FILE = 'invoice-payable-relations.json';

// POST /api/invoices/[id]/verify - 发票业务校验
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { verifiedBy } = body;

    const invoices = await readJsonFile<Invoice>(INVOICES_FILE);
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
    const relations = await readJsonFile<InvoicePayableRelation>(RELATIONS_FILE);

    const index = invoices.findIndex(inv => inv.id === id);
    if (index === -1) {
      return NextResponse.json({ error: '发票不存在' }, { status: 404 });
    }

    const invoice = invoices[index];

    // 获取关联的应付账款
    const invoiceRelations = relations.filter(r => r.invoiceId === id);
    if (invoiceRelations.length === 0) {
      return NextResponse.json({ error: '发票未关联应付账款' }, { status: 400 });
    }

    // 业务校验逻辑
    const errors: string[] = [];

    // 1. 校验供应商是否匹配
    for (const relation of invoiceRelations) {
      const payable = payables.find(p => p.id === relation.payableId);
      if (payable && payable.supplierId !== invoice.supplierId) {
        errors.push(`发票供应商与应付账款 ${payable.payableNo} 的供应商不匹配`);
      }
    }

    // 2. 校验金额是否合理
    const totalAllocated = invoiceRelations.reduce((sum, r) => sum + r.allocatedAmount, 0);
    if (totalAllocated > invoice.totalAmount) {
      errors.push('分摊金额超过发票总金额');
    }

    if (errors.length > 0) {
      invoice.usable = false;
      invoice.unusableReason = errors.join('; ');
    }

    invoice.verifiedAt = now();
    invoice.verifiedBy = verifiedBy || '系统';
    invoice.updatedAt = now();

    invoices[index] = invoice;
    await writeJsonFile(INVOICES_FILE, invoices);

    return NextResponse.json({
      ...invoice,
      errors,
      message: errors.length === 0 ? '业务校验通过' : '业务校验发现问题',
    });
  } catch (error) {
    console.error('发票业务校验失败:', error);
    return NextResponse.json({ error: '发票业务校验失败' }, { status: 500 });
  }
}
