import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, generateId, now, Invoice, AccountsPayable, InvoicePayableRelation, VerificationRecord } from '@/lib/db';

const FILE_NAME = 'invoices.json';
const PAYABLES_FILE = 'accounts-payable.json';
const RELATIONS_FILE = 'invoice-payable-relations.json';
const VERIFICATIONS_FILE = 'verifications.json';

// GET /api/invoices - 获取发票列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const verificationStatus = searchParams.get('verificationStatus');
    const usable = searchParams.get('usable');
    const authenticityStatus = searchParams.get('authenticityStatus');
    const inputMethod = searchParams.get('inputMethod');

    let invoices = await readJsonFile<Invoice>(FILE_NAME);
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);

    if (supplierId) {
      invoices = invoices.filter(inv => inv.supplierId === supplierId);
    }
    if (verificationStatus) {
      invoices = invoices.filter(inv => inv.verificationStatus === verificationStatus);
    }
    if (usable !== null && usable !== undefined && usable !== '') {
      invoices = invoices.filter(inv => inv.usable === (usable === 'true'));
    }
    if (authenticityStatus) {
      invoices = invoices.filter(inv => inv.authenticityStatus === authenticityStatus);
    }
    if (inputMethod) {
      invoices = invoices.filter(inv => inv.inputMethod === inputMethod);
    }

    invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 为每张发票添加核销类型信息
    const invoicesWithVerificationType = invoices.map(invoice => {
      // 查找该发票参与的核销记录
      const relatedVerifications = verifications.filter(v => 
        v.status === 'completed' && 
        (v.invoiceId === invoice.id || v.invoiceIds?.includes(invoice.id))
      );
      
      // 判断核销类型
      let lastVerificationType: 'auto' | 'manual' | null = null;
      if (relatedVerifications.length > 0) {
        // 获取最新的核销记录类型
        const latestVerification = relatedVerifications.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        // 兼容旧数据：如果没有 verificationType，通过 verifiedBy 判断
        lastVerificationType = latestVerification.verificationType || 
          (latestVerification.verifiedBy === '系统自动核销' ? 'auto' : 'manual');
      }
      
      return {
        ...invoice,
        lastVerificationType,
      };
    });

    return NextResponse.json(invoicesWithVerificationType);
  } catch (error) {
    console.error('获取发票列表失败:', error);
    return NextResponse.json({ error: '获取发票列表失败' }, { status: 500 });
  }
}

// POST /api/invoices - 新增发票（含重复校验、多对多关联）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoices = await readJsonFile<Invoice>(FILE_NAME);
    const payables = await readJsonFile<AccountsPayable>(PAYABLES_FILE);
    const relations = await readJsonFile<InvoicePayableRelation>(RELATIONS_FILE);

    // 重复校验：发票代码 + 发票号码 唯一（跨供应商也检测）
    const exists = invoices.find(
      inv => inv.invoiceCode === body.invoiceCode && inv.invoiceNo === body.invoiceNo
    );
    if (exists) {
      const existingDate = exists.createdAt.split('T')[0];
      return NextResponse.json({ 
        error: `发票重复，该发票已于 ${existingDate} 录入` 
      }, { status: 400 });
    }

    const totalAmount = body.totalAmount || (body.amount + body.taxAmount);

    const newInvoice: Invoice = {
      id: generateId(),
      invoiceNo: body.invoiceNo,
      invoiceCode: body.invoiceCode,
      invoiceType: body.invoiceType || 'vat_special',
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      sellerName: body.sellerName || body.supplierName,
      sellerTaxNo: body.sellerTaxNo || '',
      amount: body.amount || 0,
      taxAmount: body.taxAmount || 0,
      totalAmount,
      invoiceDate: body.invoiceDate || new Date().toISOString().split('T')[0],
      receivedDate: body.receivedDate || new Date().toISOString().split('T')[0],
      inputMethod: body.inputMethod || 'manual',
      originalFilePath: body.originalFilePath,
      authenticityStatus: 'pending',
      usable: true, // 默认可用，待校验
      verifiedAmount: 0,
      unverifiedAmount: totalAmount,
      verificationStatus: 'unverified',
      remarks: body.remarks,
      createdAt: now(),
      updatedAt: now(),
    };

    invoices.push(newInvoice);

    // 处理多对多关联应付账款
    const payableAllocations: { payableId: string; amount: number }[] = body.payableAllocations || [];
    
    // 兼容旧版单选格式
    if (payableAllocations.length === 0 && body.payableIds && body.payableIds.length > 0) {
      const allocatedAmounts = body.allocatedAmounts || {};
      for (const payableId of body.payableIds) {
        payableAllocations.push({
          payableId,
          amount: allocatedAmounts[payableId] || totalAmount / body.payableIds.length,
        });
      }
    }

    // 校验并创建关联关系
    for (const allocation of payableAllocations) {
      const payableIndex = payables.findIndex(p => p.id === allocation.payableId);
      if (payableIndex === -1) continue;

      const payable = payables[payableIndex];
      const remainingInvoicable = payable.payableAmount - payable.invoicedAmount;

      // 校验分摊金额不超过应付账款剩余可开票金额
      if (allocation.amount > remainingInvoicable) {
        return NextResponse.json({ 
          error: `发票分摊金额不能超过应付账款 ${payable.payableNo} 的剩余可开票金额 ¥${remainingInvoicable.toFixed(2)}` 
        }, { status: 400 });
      }

      // 创建关联关系
      relations.push({
        id: generateId(),
        invoiceId: newInvoice.id,
        payableId: allocation.payableId,
        allocatedAmount: allocation.amount,
        createdAt: now(),
      });

      // 更新应付账款的已开票金额
      payables[payableIndex].invoicedAmount += allocation.amount;
      payables[payableIndex].updatedAt = now();
    }

    // 保存数据
    await Promise.all([
      writeJsonFile(FILE_NAME, invoices),
      writeJsonFile(RELATIONS_FILE, relations),
      writeJsonFile(PAYABLES_FILE, payables),
    ]);

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error) {
    console.error('创建发票失败:', error);
    return NextResponse.json({ error: '创建发票失败' }, { status: 500 });
  }
}
