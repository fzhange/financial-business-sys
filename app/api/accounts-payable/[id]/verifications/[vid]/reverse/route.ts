import { NextResponse } from 'next/server';
import { 
  readJsonFile, writeJsonFile, now, 
  AccountsPayable, PaymentOrder, Invoice, VerificationRecord 
} from '@/lib/db';

const PAYABLES_FILE = 'accounts-payable.json';
const PAYMENT_ORDERS_FILE = 'payment-orders.json';
const INVOICES_FILE = 'invoices.json';
const VERIFICATIONS_FILE = 'verifications.json';

// 判断是否为跨月核销（核销日期与当前日期不在同一月）
function isCrossMonthVerification(verificationDate: string): boolean {
  const verificationMonth = verificationDate.substring(0, 7); // YYYY-MM
  const currentMonth = new Date().toISOString().substring(0, 7);
  return verificationMonth !== currentMonth;
}

// POST /api/accounts-payable/[id]/verifications/[vid]/reverse - 冲销核销记录
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  try {
    const { id, vid } = await params;
    const body = await request.json();
    const { reverseReasonType, reverseReasonDetail, reversedBy, approvalConfirmed } = body;

    // 校验冲销原因
    if (!reverseReasonType) {
      return NextResponse.json({ error: '请选择冲销原因类型' }, { status: 400 });
    }
    if (!reverseReasonDetail || reverseReasonDetail.length < 10) {
      return NextResponse.json({ error: '冲销原因详情至少需要10个字符' }, { status: 400 });
    }

    // 读取核销记录
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);
    const verificationIndex = verifications.findIndex(v => v.id === vid && v.payableId === id);
    if (verificationIndex === -1) {
      return NextResponse.json({ error: '核销记录不存在' }, { status: 404 });
    }
    const verification = verifications[verificationIndex];

    if (verification.status === 'reversed') {
      return NextResponse.json({ error: '该核销记录已冲销' }, { status: 400 });
    }

    // 检查是否跨月核销，需要审批确认
    const isCrossMonth = isCrossMonthVerification(verification.verificationDate);
    if (isCrossMonth && !approvalConfirmed) {
      return NextResponse.json({ 
        error: '该核销为跨月核销，需要审批确认后方可执行',
        requireApproval: true,
        crossMonth: true,
        verificationMonth: verification.verificationDate.substring(0, 7),
      }, { status: 400 });
    }

    // 读取其他相关数据
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
    const paymentOrders = await readJsonFile<PaymentOrder>(PAYMENT_ORDERS_FILE);
    const invoices = await readJsonFile<Invoice>(INVOICES_FILE);

    const amount = verification.amount;

    // 查找并更新应付账款
    const payableIndex = payables.findIndex(p => p.id === verification.payableId);
    if (payableIndex !== -1) {
      const payable = payables[payableIndex];
      payable.verifiedAmount -= amount;
      payable.unverifiedAmount = payable.payableAmount - payable.verifiedAmount;
      if (payable.verifiedAmount === 0) {
        payable.verificationStatus = 'unverified';
      } else {
        payable.verificationStatus = 'partial_verified';
      }
      payable.updatedAt = now();
      payables[payableIndex] = payable;
    }

    // 使用明细精确还原付款单（优先使用明细，向后兼容旧数据）
    if (verification.paymentOrderDetails && verification.paymentOrderDetails.length > 0) {
      // 新版本：使用明细精确还原
      for (const detail of verification.paymentOrderDetails) {
        const paymentOrderIndex = paymentOrders.findIndex(po => po.id === detail.paymentOrderId);
        if (paymentOrderIndex !== -1) {
          const paymentOrder = paymentOrders[paymentOrderIndex];
          paymentOrder.verifiedAmount -= detail.amount;
          paymentOrder.unverifiedAmount = paymentOrder.paymentAmount - paymentOrder.verifiedAmount;
          if (paymentOrder.verifiedAmount === 0) {
            paymentOrder.verificationStatus = 'unverified';
          } else {
            paymentOrder.verificationStatus = 'partial_verified';
          }
          paymentOrder.updatedAt = now();
          paymentOrders[paymentOrderIndex] = paymentOrder;
        }
      }
    } else {
      // 旧版本兼容：使用单个 paymentOrderId，还原总金额
      const paymentOrderIndex = paymentOrders.findIndex(po => po.id === verification.paymentOrderId);
      if (paymentOrderIndex !== -1) {
        const paymentOrder = paymentOrders[paymentOrderIndex];
        paymentOrder.verifiedAmount -= amount;
        paymentOrder.unverifiedAmount = paymentOrder.paymentAmount - paymentOrder.verifiedAmount;
        if (paymentOrder.verifiedAmount === 0) {
          paymentOrder.verificationStatus = 'unverified';
        } else {
          paymentOrder.verificationStatus = 'partial_verified';
        }
        paymentOrder.updatedAt = now();
        paymentOrders[paymentOrderIndex] = paymentOrder;
      }
    }

    // 使用明细精确还原发票（优先使用明细，向后兼容旧数据）
    if (verification.invoiceDetails && verification.invoiceDetails.length > 0) {
      // 新版本：使用明细精确还原
      for (const detail of verification.invoiceDetails) {
        const invoiceIndex = invoices.findIndex(inv => inv.id === detail.invoiceId);
        if (invoiceIndex !== -1) {
          const invoice = invoices[invoiceIndex];
          invoice.verifiedAmount -= detail.amount;
          invoice.unverifiedAmount = invoice.totalAmount - invoice.verifiedAmount;
          if (invoice.verifiedAmount === 0) {
            invoice.verificationStatus = 'unverified';
          } else {
            invoice.verificationStatus = 'partial_verified';
          }
          invoice.updatedAt = now();
          invoices[invoiceIndex] = invoice;
        }
      }
    } else {
      // 旧版本兼容：使用单个 invoiceId，还原总金额
      const invoiceIndex = invoices.findIndex(inv => inv.id === verification.invoiceId);
      if (invoiceIndex !== -1) {
        const invoice = invoices[invoiceIndex];
        invoice.verifiedAmount -= amount;
        invoice.unverifiedAmount = invoice.totalAmount - invoice.verifiedAmount;
        if (invoice.verifiedAmount === 0) {
          invoice.verificationStatus = 'unverified';
        } else {
          invoice.verificationStatus = 'partial_verified';
        }
        invoice.updatedAt = now();
        invoices[invoiceIndex] = invoice;
      }
    }

    // 更新核销记录状态
    verification.status = 'reversed';
    verification.reversedAt = now();
    verification.reversedBy = reversedBy || '系统';
    verification.reverseReasonType = reverseReasonType;
    verification.reverseReasonDetail = reverseReasonDetail;
    verification.updatedAt = now();
    // 记录是否为跨月冲销及审批信息
    if (isCrossMonth) {
      (verification as VerificationRecord & { crossMonthApproved?: boolean }).crossMonthApproved = true;
    }
    verifications[verificationIndex] = verification;

    // 保存所有更新
    await Promise.all([
      writeJsonFile(PAYABLES_FILE, payables),
      writeJsonFile(PAYMENT_ORDERS_FILE, paymentOrders),
      writeJsonFile(INVOICES_FILE, invoices),
      writeJsonFile(VERIFICATIONS_FILE, verifications),
    ]);

    return NextResponse.json(verification);
  } catch (error) {
    console.error('冲销核销记录失败:', error);
    return NextResponse.json({ error: '冲销核销记录失败' }, { status: 500 });
  }
}
