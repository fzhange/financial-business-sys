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

interface VerificationConfig {
  payableId: string;
  paymentOrderIds: string[];
  invoiceIds: string[];
  amount: number;
  // 支持前端传入手动分配的明细
  paymentOrderDetails?: PaymentOrderVerificationDetail[];
  invoiceDetails?: InvoiceVerificationDetail[];
}

// POST /api/accounts-payable/batch-verify - 批量核销多个应付单
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { verifications, verifiedBy } = body as {
      verifications: VerificationConfig[];
      verifiedBy: string;
    };

    if (!verifications || verifications.length === 0) {
      return NextResponse.json({ error: '请提供核销配置' }, { status: 400 });
    }

    // 读取所有相关数据
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
    const paymentOrders = await readJsonFile<PaymentOrder>(PAYMENT_ORDERS_FILE);
    const invoices = await readJsonFile<Invoice>(INVOICES_FILE);
    const verificationRecords = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);

    const results: { payableId: string; success: boolean; error?: string; verificationNo?: string }[] = [];
    const newVerifications: VerificationRecord[] = [];

    // 处理每个应付单的核销
    for (const config of verifications) {
      const { payableId, paymentOrderIds, invoiceIds, amount } = config;
      // 支持前端传入手动分配的明细
      const inputPaymentOrderDetails = config.paymentOrderDetails;
      const inputInvoiceDetails = config.invoiceDetails;

      // 基本验证
      if (paymentOrderIds.length === 0) {
        results.push({ payableId, success: false, error: '未选择付款单' });
        continue;
      }
      if (invoiceIds.length === 0) {
        results.push({ payableId, success: false, error: '未选择发票' });
        continue;
      }
      if (amount <= 0) {
        results.push({ payableId, success: false, error: '核销金额必须大于0' });
        continue;
      }

      // 查找应付账款
      const payableIndex = payables.findIndex(p => p.id === payableId);
      if (payableIndex === -1) {
        results.push({ payableId, success: false, error: '应付账款不存在' });
        continue;
      }
      const payable = payables[payableIndex];

      // 查找并校验所有付款单
      const selectedPaymentOrders: { index: number; order: PaymentOrder }[] = [];
      let totalPaymentUnverified = 0;
      let paymentOrderError = '';
      for (const poId of paymentOrderIds) {
        const index = paymentOrders.findIndex(po => po.id === poId);
        if (index === -1) {
          paymentOrderError = `付款单 ${poId} 不存在`;
          break;
        }
        selectedPaymentOrders.push({ index, order: paymentOrders[index] });
        totalPaymentUnverified += paymentOrders[index].unverifiedAmount;
      }
      if (paymentOrderError) {
        results.push({ payableId, success: false, error: paymentOrderError });
        continue;
      }

      // 查找并校验所有发票
      const selectedInvoices: { index: number; invoice: Invoice }[] = [];
      let totalInvoiceUnverified = 0;
      let invoiceError = '';
      for (const invId of invoiceIds) {
        const index = invoices.findIndex(inv => inv.id === invId);
        if (index === -1) {
          invoiceError = `发票 ${invId} 不存在`;
          break;
        }
        selectedInvoices.push({ index, invoice: invoices[index] });
        totalInvoiceUnverified += invoices[index].unverifiedAmount;
      }
      if (invoiceError) {
        results.push({ payableId, success: false, error: invoiceError });
        continue;
      }

      // 校验核销金额
      const maxAmount = Math.min(totalPaymentUnverified, totalInvoiceUnverified, payable.unverifiedAmount);
      if (amount > maxAmount) {
        results.push({ 
          payableId, 
          success: false, 
          error: `核销金额不能超过 ${maxAmount.toFixed(2)}` 
        });
        continue;
      }

      // 按比例分配核销金额到各付款单，并记录明细
      // 优先使用前端传入的手动分配明细，否则自动按顺序分配
      let remainingAmount = amount;
      let paymentOrderDetails: PaymentOrderVerificationDetail[] = [];
      
      if (inputPaymentOrderDetails && inputPaymentOrderDetails.length > 0) {
        // 使用前端传入的手动分配明细
        for (const detail of inputPaymentOrderDetails) {
          const { index, order } = selectedPaymentOrders.find(({ order }) => order.id === detail.paymentOrderId) || {};
          if (index !== undefined && order) {
            const allocatedAmount = Math.min(detail.amount, order.unverifiedAmount, remainingAmount);
            if (allocatedAmount > 0) {
              paymentOrderDetails.push({
                paymentOrderId: order.id,
                amount: allocatedAmount,
              });
              paymentOrders[index].verifiedAmount += allocatedAmount;
              paymentOrders[index].unverifiedAmount = paymentOrders[index].paymentAmount - paymentOrders[index].verifiedAmount;
              if (paymentOrders[index].verifiedAmount >= paymentOrders[index].paymentAmount) {
                paymentOrders[index].verificationStatus = 'verified';
              } else {
                paymentOrders[index].verificationStatus = 'partial_verified';
              }
              paymentOrders[index].updatedAt = now();
              remainingAmount -= allocatedAmount;
            }
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

      // 按比例分配核销金额到各发票，并记录明细
      // 优先使用前端传入的手动分配明细，否则自动按顺序分配
      remainingAmount = amount;
      let invoiceDetails: InvoiceVerificationDetail[] = [];
      
      if (inputInvoiceDetails && inputInvoiceDetails.length > 0) {
        // 使用前端传入的手动分配明细
        for (const detail of inputInvoiceDetails) {
          const { index, invoice } = selectedInvoices.find(({ invoice }) => invoice.id === detail.invoiceId) || {};
          if (index !== undefined && invoice) {
            const allocatedAmount = Math.min(detail.amount, invoice.unverifiedAmount, remainingAmount);
            if (allocatedAmount > 0) {
              invoiceDetails.push({
                invoiceId: invoice.id,
                amount: allocatedAmount,
              });
              invoices[index].verifiedAmount += allocatedAmount;
              invoices[index].unverifiedAmount = invoices[index].totalAmount - invoices[index].verifiedAmount;
              if (invoices[index].verifiedAmount >= invoices[index].totalAmount) {
                invoices[index].verificationStatus = 'verified';
              } else {
                invoices[index].verificationStatus = 'partial_verified';
              }
              invoices[index].updatedAt = now();
              remainingAmount -= allocatedAmount;
            }
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

      // 创建核销记录（包含明细）
      const newVerification: VerificationRecord = {
        id: generateId(),
        verificationNo: generateNo('HX'),
        payableId,
        paymentOrderId: paymentOrderIds[0],
        paymentOrderIds,
        invoiceId: invoiceIds[0],
        invoiceIds,
        paymentOrderDetails, // 新增：每个付款单的具体核销金额
        invoiceDetails, // 新增：每张发票的具体核销金额
        amount,
        verificationDate: new Date().toISOString().split('T')[0],
        verifiedBy: verifiedBy || '系统',
        verifiedAt: now(),
        status: 'completed',
        verificationType: 'manual', // 标记为手动核销（批量）
        remarks: '批量核销',
        createdAt: now(),
        updatedAt: now(),
      };

      // 更新应付账款核销金额
      payables[payableIndex].verifiedAmount += amount;
      payables[payableIndex].unverifiedAmount = payable.payableAmount - payables[payableIndex].verifiedAmount;
      if (payables[payableIndex].verifiedAmount >= payable.payableAmount) {
        payables[payableIndex].verificationStatus = 'verified';
      } else {
        payables[payableIndex].verificationStatus = 'partial_verified';
      }
      payables[payableIndex].updatedAt = now();

      newVerifications.push(newVerification);
      results.push({ payableId, success: true, verificationNo: newVerification.verificationNo });
    }

    // 保存所有更新
    if (newVerifications.length > 0) {
      verificationRecords.push(...newVerifications);
      await Promise.all([
        writeJsonFile(PAYABLES_FILE, payables),
        writeJsonFile(PAYMENT_ORDERS_FILE, paymentOrders),
        writeJsonFile(INVOICES_FILE, invoices),
        writeJsonFile(VERIFICATIONS_FILE, verificationRecords),
      ]);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      successCount,
      failCount,
      results,
    }, { status: 200 });
  } catch (error) {
    console.error('批量核销失败:', error);
    return NextResponse.json({ error: '批量核销失败' }, { status: 500 });
  }
}
