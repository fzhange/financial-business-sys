import { NextResponse } from 'next/server';
import { 
  readJsonFile, writeJsonFile, generateId, generateNo, now, 
  AccountsPayable, PaymentOrder, Invoice, VerificationRecord,
  PaymentOrderVerificationDetail, InvoiceVerificationDetail
} from '@/lib/db';

const PAYABLES_FILE = 'accounts-payable.json';
const PAYMENT_ORDERS_FILE = 'payment-orders.json';
const INVOICES_FILE = 'invoices.json';
const VERIFICATIONS_FILE = 'verifications.json';

// GET /api/accounts-payable/[id]/verifications - 获取应付账款的核销记录
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);
    const payableVerifications = verifications.filter(v => v.payableId === id);

    return NextResponse.json(payableVerifications);
  } catch (error) {
    console.error('获取核销记录失败:', error);
    return NextResponse.json({ error: '获取核销记录失败' }, { status: 500 });
  }
}

// POST /api/accounts-payable/[id]/verifications - 新增核销记录（三单核销，支持多选和手动分配）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    // 支持单选（兼容旧版）和多选
    const paymentOrderIds: string[] = body.paymentOrderIds || (body.paymentOrderId ? [body.paymentOrderId] : []);
    const invoiceIds: string[] = body.invoiceIds || (body.invoiceId ? [body.invoiceId] : []);
    // 新增：支持前端传入手动分配的明细
    const inputPaymentOrderDetails: PaymentOrderVerificationDetail[] = body.paymentOrderDetails || [];
    const inputInvoiceDetails: InvoiceVerificationDetail[] = body.invoiceDetails || [];
    const { amount, verifiedBy, remarks } = body;

    if (paymentOrderIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一个付款单' }, { status: 400 });
    }
    if (invoiceIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一张发票' }, { status: 400 });
    }

    // 读取所有相关数据
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
    const paymentOrders = await readJsonFile<PaymentOrder>(PAYMENT_ORDERS_FILE);
    const invoices = await readJsonFile<Invoice>(INVOICES_FILE);
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);

    // 查找应付账款
    const payableIndex = payables.findIndex(p => p.id === id);
    if (payableIndex === -1) {
      return NextResponse.json({ error: '应付账款不存在' }, { status: 404 });
    }
    const payable = payables[payableIndex];

    // 查找并校验所有付款单
    const selectedPaymentOrders: { index: number; order: PaymentOrder }[] = [];
    let totalPaymentUnverified = 0;
    for (const poId of paymentOrderIds) {
      const index = paymentOrders.findIndex(po => po.id === poId);
      if (index === -1) {
        return NextResponse.json({ error: `付款单 ${poId} 不存在` }, { status: 404 });
      }
      selectedPaymentOrders.push({ index, order: paymentOrders[index] });
      totalPaymentUnverified += paymentOrders[index].unverifiedAmount;
    }

    // 查找并校验所有发票
    const selectedInvoices: { index: number; invoice: Invoice }[] = [];
    let totalInvoiceUnverified = 0;
    for (const invId of invoiceIds) {
      const index = invoices.findIndex(inv => inv.id === invId);
      if (index === -1) {
        return NextResponse.json({ error: `发票 ${invId} 不存在` }, { status: 404 });
      }
      selectedInvoices.push({ index, invoice: invoices[index] });
      totalInvoiceUnverified += invoices[index].unverifiedAmount;
    }

    // 校验核销金额
    const maxAmount = Math.min(totalPaymentUnverified, totalInvoiceUnverified, payable.unverifiedAmount);

    if (amount <= 0) {
      return NextResponse.json({ error: '核销金额必须大于0' }, { status: 400 });
    }
    if (amount > maxAmount) {
      return NextResponse.json({ 
        error: `核销金额不能超过 ${maxAmount.toFixed(2)}（取应付未核销、付款未核销、发票未核销的最小值）` 
      }, { status: 400 });
    }

    // 判断是否使用前端传入的手动分配明细
    const useManualAllocation = inputPaymentOrderDetails.length > 0 && inputInvoiceDetails.length > 0;

    // 处理付款单核销：优先使用手动分配，否则自动按顺序分配
    let remainingAmount = amount;
    const paymentOrderDetails: PaymentOrderVerificationDetail[] = [];
    
    if (useManualAllocation) {
      // 使用前端传入的手动分配
      for (const detail of inputPaymentOrderDetails) {
        if (detail.amount <= 0) continue;
        const poIndex = paymentOrders.findIndex(po => po.id === detail.paymentOrderId);
        if (poIndex === -1) continue;
        
        // 校验金额不超过可核销金额
        const allocatedAmount = Math.min(detail.amount, paymentOrders[poIndex].unverifiedAmount);
        if (allocatedAmount > 0) {
          paymentOrderDetails.push({
            paymentOrderId: detail.paymentOrderId,
            amount: allocatedAmount,
          });
          paymentOrders[poIndex].verifiedAmount += allocatedAmount;
          paymentOrders[poIndex].unverifiedAmount = paymentOrders[poIndex].paymentAmount - paymentOrders[poIndex].verifiedAmount;
          if (paymentOrders[poIndex].verifiedAmount >= paymentOrders[poIndex].paymentAmount) {
            paymentOrders[poIndex].verificationStatus = 'verified';
          } else {
            paymentOrders[poIndex].verificationStatus = 'partial_verified';
          }
          paymentOrders[poIndex].updatedAt = now();
        }
      }
    } else {
      // 自动按顺序分配
      for (const { index, order } of selectedPaymentOrders) {
        const allocatedAmount = Math.min(remainingAmount, order.unverifiedAmount);
        if (allocatedAmount > 0) {
          paymentOrderDetails.push({
            paymentOrderId: order.id,
            amount: allocatedAmount,
          });
        }
        paymentOrders[index].verifiedAmount += allocatedAmount;
        paymentOrders[index].unverifiedAmount = paymentOrders[index].paymentAmount - paymentOrders[index].verifiedAmount;
        if (paymentOrders[index].verifiedAmount >= paymentOrders[index].paymentAmount) {
          paymentOrders[index].verificationStatus = 'verified';
        } else {
          paymentOrders[index].verificationStatus = 'partial_verified';
        }
        paymentOrders[index].updatedAt = now();
        remainingAmount -= allocatedAmount;
        if (remainingAmount <= 0) break;
      }
    }

    // 处理发票核销：优先使用手动分配，否则自动按顺序分配
    remainingAmount = amount;
    const invoiceDetails: InvoiceVerificationDetail[] = [];
    
    if (useManualAllocation) {
      // 使用前端传入的手动分配
      for (const detail of inputInvoiceDetails) {
        if (detail.amount <= 0) continue;
        const invIndex = invoices.findIndex(inv => inv.id === detail.invoiceId);
        if (invIndex === -1) continue;
        
        // 校验金额不超过可核销金额
        const allocatedAmount = Math.min(detail.amount, invoices[invIndex].unverifiedAmount);
        if (allocatedAmount > 0) {
          invoiceDetails.push({
            invoiceId: detail.invoiceId,
            amount: allocatedAmount,
          });
          invoices[invIndex].verifiedAmount += allocatedAmount;
          invoices[invIndex].unverifiedAmount = invoices[invIndex].totalAmount - invoices[invIndex].verifiedAmount;
          if (invoices[invIndex].verifiedAmount >= invoices[invIndex].totalAmount) {
            invoices[invIndex].verificationStatus = 'verified';
          } else {
            invoices[invIndex].verificationStatus = 'partial_verified';
          }
          invoices[invIndex].updatedAt = now();
        }
      }
    } else {
      // 自动按顺序分配
      for (const { index, invoice } of selectedInvoices) {
        const allocatedAmount = Math.min(remainingAmount, invoice.unverifiedAmount);
        if (allocatedAmount > 0) {
          invoiceDetails.push({
            invoiceId: invoice.id,
            amount: allocatedAmount,
          });
        }
        invoices[index].verifiedAmount += allocatedAmount;
        invoices[index].unverifiedAmount = invoices[index].totalAmount - invoices[index].verifiedAmount;
        if (invoices[index].verifiedAmount >= invoices[index].totalAmount) {
          invoices[index].verificationStatus = 'verified';
        } else {
          invoices[index].verificationStatus = 'partial_verified';
        }
        invoices[index].updatedAt = now();
        remainingAmount -= allocatedAmount;
        if (remainingAmount <= 0) break;
      }
    }

    // 创建核销记录（记录所有关联的付款单和发票ID及其具体核销金额）
    const newVerification: VerificationRecord = {
      id: generateId(),
      verificationNo: generateNo('HX'),
      payableId: id,
      paymentOrderId: paymentOrderIds[0], // 保留第一个用于向后兼容
      paymentOrderIds, // 所有付款单ID
      invoiceId: invoiceIds[0], // 保留第一个用于向后兼容
      invoiceIds, // 所有发票ID
      paymentOrderDetails, // 新增：每个付款单的具体核销金额
      invoiceDetails, // 新增：每张发票的具体核销金额
      amount,
      verificationDate: new Date().toISOString().split('T')[0],
      verifiedBy: verifiedBy || '系统',
      verifiedAt: now(),
      status: 'completed',
      verificationType: 'manual', // 标记为手动核销
      remarks,
      createdAt: now(),
      updatedAt: now(),
    };

    // 更新应付账款核销金额
    payable.verifiedAmount += amount;
    payable.unverifiedAmount = payable.payableAmount - payable.verifiedAmount;
    if (payable.verifiedAmount >= payable.payableAmount) {
      payable.verificationStatus = 'verified';
    } else {
      payable.verificationStatus = 'partial_verified';
    }
    payable.updatedAt = now();

    // 保存所有更新
    payables[payableIndex] = payable;
    verifications.push(newVerification);

    await Promise.all([
      writeJsonFile(PAYABLES_FILE, payables),
      writeJsonFile(PAYMENT_ORDERS_FILE, paymentOrders),
      writeJsonFile(INVOICES_FILE, invoices),
      writeJsonFile(VERIFICATIONS_FILE, verifications),
    ]);

    return NextResponse.json(newVerification, { status: 201 });
  } catch (error) {
    console.error('创建核销记录失败:', error);
    return NextResponse.json({ error: '创建核销记录失败' }, { status: 500 });
  }
}
