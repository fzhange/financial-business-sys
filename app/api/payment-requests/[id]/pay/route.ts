import { NextResponse } from 'next/server';
import { 
  readJsonFile, writeJsonFile, generateId, generateNo, now, 
  PaymentRequest, PaymentOrder, AccountsPayable, Invoice, VerificationRecord,
  PaymentOrderVerificationDetail, InvoiceVerificationDetail, PurchaseOrder
} from '@/lib/db';

const REQUESTS_FILE = 'payment-requests.json';
const ORDERS_FILE = 'payment-orders.json';
const PAYABLES_FILE = 'accounts-payable.json';
const INVOICES_FILE = 'invoices.json';
const VERIFICATIONS_FILE = 'verifications.json';
const PURCHASE_ORDERS_FILE = 'purchase-orders.json';

// POST /api/payment-requests/[id]/pay - 发起付款
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentAmount, paymentMethod, bankAccount, bankName, payableId, transactionNo, remarks } = body;

    const requests = await readJsonFile<PaymentRequest>(REQUESTS_FILE);
    const orders = await readJsonFile<PaymentOrder>(ORDERS_FILE);
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
    const invoices = await readJsonFile<Invoice>(INVOICES_FILE);
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);
    const purchaseOrders = await readJsonFile<PurchaseOrder>(PURCHASE_ORDERS_FILE);

    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return NextResponse.json({ error: '请款单不存在' }, { status: 404 });
    }

    const req = requests[reqIndex];

    if (req.status !== 'approved') {
      return NextResponse.json({ error: '只有已审批状态的请款单可以付款' }, { status: 400 });
    }

    if (paymentAmount <= 0) {
      return NextResponse.json({ error: '付款金额必须大于0' }, { status: 400 });
    }

    if (paymentAmount > req.unpaidAmount) {
      return NextResponse.json({ error: `付款金额不能超过未付金额 ${req.unpaidAmount.toFixed(2)}` }, { status: 400 });
    }

    // 创建付款单
    const targetPayableId = payableId || (req.payableIds.length > 0 ? req.payableIds[0] : '');
    const payable = payables.find(p => p.id === targetPayableId);

    const newOrder: PaymentOrder = {
      id: generateId(),
      orderNo: generateNo('FK'),
      requestId: id,
      payableId: targetPayableId,
      supplierId: req.supplierId,
      supplierName: req.supplierName,
      paymentAmount,
      paymentMethod: paymentMethod || 'bank_transfer',
      bankAccount,
      bankName,
      paymentDate: new Date().toISOString().split('T')[0],
      status: 'completed',
      verifiedAmount: 0,
      unverifiedAmount: paymentAmount,
      verificationStatus: 'unverified',
      completedAt: now(),
      transactionNo: transactionNo || `TXN${Date.now()}`,
      remarks,
      createdAt: now(),
      updatedAt: now(),
    };

    orders.push(newOrder);

    // 更新请款单
    req.paidAmount += paymentAmount;
    req.unpaidAmount = req.requestAmount - req.paidAmount;
    if (req.unpaidAmount <= 0) {
      req.status = 'paid';
    }
    req.updatedAt = now();
    requests[reqIndex] = req;

    // 更新采购单（如果是预付类型）
    if (req.purchaseOrderId) {
      const poIndex = purchaseOrders.findIndex(p => p.id === req.purchaseOrderId);
      if (poIndex !== -1) {
        purchaseOrders[poIndex].paidAmount += paymentAmount;
        purchaseOrders[poIndex].unpaidAmount = purchaseOrders[poIndex].totalAmount - purchaseOrders[poIndex].paidAmount;
        if (purchaseOrders[poIndex].paidAmount >= purchaseOrders[poIndex].totalAmount) {
          purchaseOrders[poIndex].paymentStatus = 'paid';
        } else if (purchaseOrders[poIndex].paidAmount > 0) {
          purchaseOrders[poIndex].paymentStatus = 'partial_paid';
        }
        purchaseOrders[poIndex].updatedAt = now();
      }
    }

    // 更新应付账款
    if (payable) {
      const payableIndex = payables.findIndex(p => p.id === targetPayableId);
      payables[payableIndex].paidAmount += paymentAmount;
      payables[payableIndex].unpaidAmount = payables[payableIndex].payableAmount - payables[payableIndex].paidAmount;
      if (payables[payableIndex].paidAmount >= payables[payableIndex].payableAmount) {
        payables[payableIndex].paymentStatus = 'paid';
      } else {
        payables[payableIndex].paymentStatus = 'partial_paid';
      }
      payables[payableIndex].updatedAt = now();
    }

    // ========== 自动核销逻辑 ==========
    // 获取请款单关联的发票
    const relatedInvoiceIds = req.invoiceIds || [];
    let autoVerification: VerificationRecord | null = null;
    
    if (relatedInvoiceIds.length > 0 && payable) {
      // 获取关联发票中未核销的发票
      const relatedInvoices = invoices
        .map((inv, index) => ({ inv, index }))
        .filter(({ inv }) => relatedInvoiceIds.includes(inv.id) && inv.unverifiedAmount > 0);
      
      if (relatedInvoices.length > 0) {
        // 计算可核销金额：取付款金额、发票未核销总额、应付未核销金额的最小值
        const totalInvoiceUnverified = relatedInvoices.reduce((sum, { inv }) => sum + inv.unverifiedAmount, 0);
        const payableUnverified = payable.unverifiedAmount;
        const paymentOrderUnverified = paymentAmount; // 新创建的付款单，未核销金额等于付款金额
        
        const autoVerifyAmount = Math.min(paymentOrderUnverified, totalInvoiceUnverified, payableUnverified);
        
        if (autoVerifyAmount > 0) {
          // 按顺序分配发票核销金额
          let remainingAmount = autoVerifyAmount;
          const invoiceDetails: InvoiceVerificationDetail[] = [];
          
          for (const { inv, index } of relatedInvoices) {
            if (remainingAmount <= 0) break;
            
            const allocatedAmount = Math.min(remainingAmount, inv.unverifiedAmount);
            if (allocatedAmount > 0) {
              invoiceDetails.push({
                invoiceId: inv.id,
                amount: allocatedAmount,
              });
              
              // 更新发票核销状态
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
          
          // 付款单核销明细
          const paymentOrderDetails: PaymentOrderVerificationDetail[] = [{
            paymentOrderId: newOrder.id,
            amount: autoVerifyAmount,
          }];
          
          // 更新付款单核销状态
          newOrder.verifiedAmount = autoVerifyAmount;
          newOrder.unverifiedAmount = paymentAmount - autoVerifyAmount;
          if (newOrder.verifiedAmount >= paymentAmount) {
            newOrder.verificationStatus = 'verified';
          } else {
            newOrder.verificationStatus = 'partial_verified';
          }
          
          // 更新应付账款核销状态
          const payableIndex = payables.findIndex(p => p.id === targetPayableId);
          payables[payableIndex].verifiedAmount += autoVerifyAmount;
          payables[payableIndex].unverifiedAmount = payables[payableIndex].payableAmount - payables[payableIndex].verifiedAmount;
          if (payables[payableIndex].verifiedAmount >= payables[payableIndex].payableAmount) {
            payables[payableIndex].verificationStatus = 'verified';
          } else {
            payables[payableIndex].verificationStatus = 'partial_verified';
          }
          
          // 创建自动核销记录
          autoVerification = {
            id: generateId(),
            verificationNo: generateNo('HX'),
            payableId: targetPayableId,
            paymentOrderId: newOrder.id,
            paymentOrderIds: [newOrder.id],
            invoiceId: invoiceDetails[0]?.invoiceId || '',
            invoiceIds: invoiceDetails.map(d => d.invoiceId),
            paymentOrderDetails,
            invoiceDetails,
            amount: autoVerifyAmount,
            verificationDate: new Date().toISOString().split('T')[0],
            verifiedBy: '系统自动核销',
            verifiedAt: now(),
            status: 'completed',
            verificationType: 'auto', // 标记为自动核销
            remarks: `付款单 ${newOrder.orderNo} 付款后自动核销`,
            createdAt: now(),
            updatedAt: now(),
          };
          
          verifications.push(autoVerification);
        }
      }
    }

    await Promise.all([
      writeJsonFile(REQUESTS_FILE, requests),
      writeJsonFile(ORDERS_FILE, orders),
      writeJsonFile(PAYABLES_FILE, payables),
      writeJsonFile(INVOICES_FILE, invoices),
      writeJsonFile(VERIFICATIONS_FILE, verifications),
      writeJsonFile(PURCHASE_ORDERS_FILE, purchaseOrders),
    ]);

    // 返回付款单和自动核销信息
    return NextResponse.json({
      paymentOrder: newOrder,
      autoVerification: autoVerification || null,
      message: autoVerification 
        ? `付款成功，已自动核销 ${autoVerification.amount.toFixed(2)} 元` 
        : '付款成功'
    }, { status: 201 });
  } catch (error) {
    console.error('发起付款失败:', error);
    return NextResponse.json({ error: '发起付款失败' }, { status: 500 });
  }
}
