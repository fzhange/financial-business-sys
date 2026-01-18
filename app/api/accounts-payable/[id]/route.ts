import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, AccountsPayable, PaymentOrder, Invoice, VerificationRecord, SupplierStatement } from '@/lib/db';

const FILE_NAME = 'accounts-payable.json';
const PAYMENT_ORDERS_FILE = 'payment-orders.json';
const INVOICES_FILE = 'invoices.json';
const VERIFICATIONS_FILE = 'verifications.json';
const STATEMENTS_FILE = 'supplier-statements.json';

// GET /api/accounts-payable/[id] - 获取应付账款详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payables = await readJsonFile<AccountsPayable>(FILE_NAME);
    const payable = payables.find(p => p.id === id);

    if (!payable) {
      return NextResponse.json({ error: '应付账款不存在' }, { status: 404 });
    }

    // 获取关联的对账单号
    let statementNo: string | undefined;
    if (payable.statementId) {
      const statements = await readJsonFile<SupplierStatement>(STATEMENTS_FILE);
      const statement = statements.find(s => s.id === payable.statementId);
      statementNo = statement?.statementNo;
    }

    // 获取关联的付款单
    const paymentOrders = await readJsonFile<PaymentOrder>(PAYMENT_ORDERS_FILE);
    const relatedPaymentOrders = paymentOrders.filter(po => po.payableId === id);

    // 获取关联的发票（通过 invoice-payable-relations）
    const invoices = await readJsonFile<Invoice>(INVOICES_FILE);
    // 简化处理：获取该供应商的所有可用发票
    const relatedInvoices = invoices.filter(inv => inv.supplierId === payable.supplierId && inv.usable);

    // 获取核销记录
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);
    const relatedVerifications = verifications.filter(v => v.payableId === id);

    return NextResponse.json({
      ...payable,
      statementNo,
      paymentOrders: relatedPaymentOrders,
      invoices: relatedInvoices,
      verifications: relatedVerifications,
    });
  } catch (error) {
    console.error('获取应付账款详情失败:', error);
    return NextResponse.json({ error: '获取应付账款详情失败' }, { status: 500 });
  }
}

// PUT /api/accounts-payable/[id] - 更新应付账款
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const payables = await readJsonFile<AccountsPayable>(FILE_NAME);
    const index = payables.findIndex(p => p.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '应付账款不存在' }, { status: 404 });
    }

    const updatedPayable: AccountsPayable = {
      ...payables[index],
      ...body,
      updatedAt: now(),
    };

    // 自动计算状态
    updatedPayable.unpaidAmount = updatedPayable.payableAmount - updatedPayable.paidAmount;
    updatedPayable.unverifiedAmount = updatedPayable.payableAmount - updatedPayable.verifiedAmount;

    if (updatedPayable.paidAmount === 0) {
      updatedPayable.paymentStatus = 'unpaid';
    } else if (updatedPayable.paidAmount >= updatedPayable.payableAmount) {
      updatedPayable.paymentStatus = 'paid';
    } else {
      updatedPayable.paymentStatus = 'partial_paid';
    }

    if (updatedPayable.verifiedAmount === 0) {
      updatedPayable.verificationStatus = 'unverified';
    } else if (updatedPayable.verifiedAmount >= updatedPayable.payableAmount) {
      updatedPayable.verificationStatus = 'verified';
    } else {
      updatedPayable.verificationStatus = 'partial_verified';
    }

    payables[index] = updatedPayable;
    await writeJsonFile(FILE_NAME, payables);

    return NextResponse.json(updatedPayable);
  } catch (error) {
    console.error('更新应付账款失败:', error);
    return NextResponse.json({ error: '更新应付账款失败' }, { status: 500 });
  }
}
