import { NextResponse } from 'next/server';
import { 
  readJsonFile, writeJsonFile, generateId, generateNo, now, 
  SupplierStatement, AccountsPayable, PurchaseRecord, PurchaseOrder, PaymentRequest, PaymentOrder, VerificationRecord
} from '@/lib/db';

const STATEMENTS_FILE = 'supplier-statements.json';
const PAYABLES_FILE = 'accounts-payable.json';
const PURCHASE_RECORDS_FILE = 'purchase-records.json';
const PURCHASE_ORDERS_FILE = 'purchase-orders.json';
const PAYMENT_REQUESTS_FILE = 'payment-requests.json';
const PAYMENT_ORDERS_FILE = 'payment-orders.json';
const VERIFICATIONS_FILE = 'verifications.json';

// POST /api/supplier-statements/[id]/confirm - 确认对账单
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { confirmType, confirmedBy } = body; // confirmType: 'supplier' | 'buyer'

    const statements = await readJsonFile<SupplierStatement>(STATEMENTS_FILE);
    const index = statements.findIndex(s => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '对账单不存在' }, { status: 404 });
    }

    const statement = statements[index];

    if (statement.status === 'confirmed') {
      return NextResponse.json({ error: '对账单已确认' }, { status: 400 });
    }

    // 供应商确认
    if (confirmType === 'supplier') {
      statement.supplierConfirmed = true;
      statement.supplierConfirmedAt = now();
      statement.status = 'pending_buyer_confirm';
    }
    // 采购方确认
    else if (confirmType === 'buyer') {
      if (!statement.supplierConfirmed) {
        return NextResponse.json({ error: '请先等待供应商确认' }, { status: 400 });
      }
      statement.buyerConfirmed = true;
      statement.buyerConfirmedAt = now();
      statement.buyerConfirmedBy = confirmedBy;
      statement.status = 'confirmed';

      // 生成应付账款
      const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 默认30天账期

      const newPayable: AccountsPayable = {
        id: generateId(),
        payableNo: generateNo('YF'),
        statementId: statement.id,
        supplierId: statement.supplierId,
        supplierName: statement.supplierName,
        payableAmount: statement.netAmount,
        paidAmount: 0,
        unpaidAmount: statement.netAmount,
        invoicedAmount: 0,
        verifiedAmount: 0,
        unverifiedAmount: statement.netAmount,
        paymentStatus: 'unpaid',
        verificationStatus: 'unverified',
        dueDate: dueDate.toISOString().split('T')[0],
        createdAt: now(),
        updatedAt: now(),
      };

      // ========== 预付采购单自动核销逻辑 ==========
      // 1. 查找对账单关联的采购单
      const purchaseRecords = await readJsonFile<PurchaseRecord>(PURCHASE_RECORDS_FILE);
      const relatedRecords = purchaseRecords.filter(r => statement.purchaseRecordIds.includes(r.id));
      const poNos = Array.from(new Set(relatedRecords.map(r => r.poNo).filter(Boolean)));

      if (poNos.length > 0) {
        const purchaseOrders = await readJsonFile<PurchaseOrder>(PURCHASE_ORDERS_FILE);
        const relatedPOs = purchaseOrders.filter(po => poNos.includes(po.orderNo) && po.type === 'prepaid');

        if (relatedPOs.length > 0) {
          const poIds = relatedPOs.map(po => po.id);
          const paymentRequests = await readJsonFile<PaymentRequest>(PAYMENT_REQUESTS_FILE);
          const relatedRequests = paymentRequests.filter(pr => pr.purchaseOrderId && poIds.includes(pr.purchaseOrderId));
          
          if (relatedRequests.length > 0) {
            const requestIds = relatedRequests.map(pr => pr.id);
            const paymentOrders = await readJsonFile<PaymentOrder>(PAYMENT_ORDERS_FILE);
            const unverifiedPayments = paymentOrders.filter(po => requestIds.includes(po.requestId) && po.unverifiedAmount > 0);

            if (unverifiedPayments.length > 0) {
              const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);
              let remainingPayableUnverified = newPayable.unverifiedAmount;

              for (const payment of unverifiedPayments) {
                if (remainingPayableUnverified <= 0) break;

                const verifyAmount = Math.min(remainingPayableUnverified, payment.unverifiedAmount);
                if (verifyAmount > 0) {
                  // 更新应付账款
                  newPayable.verifiedAmount += verifyAmount;
                  newPayable.unverifiedAmount -= verifyAmount;
                  if (newPayable.verifiedAmount >= newPayable.payableAmount) {
                    newPayable.verificationStatus = 'verified';
                  } else {
                    newPayable.verificationStatus = 'partial_verified';
                  }

                  // 更新付款单
                  const pIndex = paymentOrders.findIndex(p => p.id === payment.id);
                  paymentOrders[pIndex].verifiedAmount += verifyAmount;
                  paymentOrders[pIndex].unverifiedAmount -= verifyAmount;
                  if (paymentOrders[pIndex].verifiedAmount >= paymentOrders[pIndex].paymentAmount) {
                    paymentOrders[pIndex].verificationStatus = 'verified';
                  } else {
                    paymentOrders[pIndex].verificationStatus = 'partial_verified';
                  }

                  // 创建核销记录
                  const newVerification: VerificationRecord = {
                    id: generateId(),
                    verificationNo: generateNo('HX'),
                    payableId: newPayable.id,
                    paymentOrderId: payment.id,
                    paymentOrderIds: [payment.id],
                    invoiceId: '', // 预付核销可能暂时没有发票
                    invoiceIds: [],
                    paymentOrderDetails: [{ paymentOrderId: payment.id, amount: verifyAmount }],
                    invoiceDetails: [],
                    amount: verifyAmount,
                    verificationDate: new Date().toISOString().split('T')[0],
                    verifiedBy: '系统自动核销(预付)',
                    verifiedAt: now(),
                    status: 'completed',
                    verificationType: 'auto',
                    remarks: `预付采购单自动核销`,
                    createdAt: now(),
                    updatedAt: now(),
                  };
                  verifications.push(newVerification);
                  remainingPayableUnverified -= verifyAmount;
                }
              }

              // 保存更新后的付款单和核销记录
              await writeJsonFile(PAYMENT_ORDERS_FILE, paymentOrders);
              await writeJsonFile(VERIFICATIONS_FILE, verifications);
            }
          }
        }
      }

      payables.push(newPayable);
      await writeJsonFile(PAYABLES_FILE, payables);
    }

    statement.updatedAt = now();
    statements[index] = statement;
    await writeJsonFile(STATEMENTS_FILE, statements);

    return NextResponse.json(statement);
  } catch (error) {
    console.error('确认对账单失败:', error);
    return NextResponse.json({ error: '确认对账单失败' }, { status: 500 });
  }
}
