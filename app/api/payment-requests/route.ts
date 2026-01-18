import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, generateId, generateNo, now, PaymentRequest, Invoice, PurchaseOrder } from '@/lib/db';

const FILE_NAME = 'payment-requests.json';
const INVOICES_FILE = 'invoices.json';
const PURCHASE_ORDERS_FILE = 'purchase-orders.json';

// GET /api/payment-requests - 获取请款单列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');

    let requests = await readJsonFile<PaymentRequest>(FILE_NAME);

    if (supplierId) {
      requests = requests.filter(r => r.supplierId === supplierId);
    }
    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(requests);
  } catch (error) {
    console.error('获取请款单列表失败:', error);
    return NextResponse.json({ error: '获取请款单列表失败' }, { status: 500 });
  }
}

// POST /api/payment-requests - 新增请款单
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requests = await readJsonFile<PaymentRequest>(FILE_NAME);

    const invoiceIds = body.invoiceIds || [];
    const purchaseOrderId = body.purchaseOrderId;

    // 校验：请款必须关联至少一张已校验发票 或 关联一个预付类型的采购单
    if (invoiceIds.length === 0 && !purchaseOrderId) {
      return NextResponse.json({ error: '请款必须关联至少一张已校验发票或预付采购单' }, { status: 400 });
    }

    if (purchaseOrderId) {
      const pos = await readJsonFile<PurchaseOrder>(PURCHASE_ORDERS_FILE);
      const po = pos.find(p => p.id === purchaseOrderId);
      if (!po) {
        return NextResponse.json({ error: '关联的采购单不存在' }, { status: 400 });
      }
      if (po.type !== 'prepaid') {
        return NextResponse.json({ error: '只有预付类型的采购单可以提前发起请款' }, { status: 400 });
      }
      
      // 校验请款金额
      if (body.requestAmount > po.unpaidAmount) {
        return NextResponse.json({ 
          error: `请款金额不能超过采购单未付金额（未付金额：¥${po.unpaidAmount.toFixed(2)}）` 
        }, { status: 400 });
      }
    } else {
      // 校验：请款金额不能超过关联发票的价税合计
      const invoices = await readJsonFile<Invoice>(INVOICES_FILE);
      const relatedInvoices = invoices.filter(inv => invoiceIds.includes(inv.id));
      const totalInvoiceAmount = relatedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      
      if (body.requestAmount > totalInvoiceAmount) {
        return NextResponse.json({ 
          error: `请款金额不能超过发票金额（发票总额：¥${totalInvoiceAmount.toFixed(2)}）` 
        }, { status: 400 });
      }
    }

    const newRequest: PaymentRequest = {
      id: generateId(),
      requestNo: generateNo('QK'),
      payableIds: body.payableIds || [],
      invoiceIds: invoiceIds,
      purchaseOrderId: purchaseOrderId,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      requestAmount: body.requestAmount,
      paidAmount: 0,
      unpaidAmount: body.requestAmount,
      requestReason: body.requestReason || '',
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
    };

    requests.push(newRequest);
    await writeJsonFile(FILE_NAME, requests);

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error('创建请款单失败:', error);
    return NextResponse.json({ error: '创建请款单失败' }, { status: 500 });
  }
}
