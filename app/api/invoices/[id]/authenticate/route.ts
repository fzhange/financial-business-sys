import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, Invoice } from '@/lib/db';

const FILE_NAME = 'invoices.json';

// POST /api/invoices/[id]/authenticate - 发票真伪校验
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoices = await readJsonFile<Invoice>(FILE_NAME);
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '发票不存在' }, { status: 404 });
    }

    const invoice = invoices[index];

    // 已校验的发票不需要再校验
    if (invoice.authenticityStatus !== 'pending') {
      return NextResponse.json({ 
        error: `发票已校验，状态：${invoice.authenticityStatus === 'verified' ? '已验真' : '验证失败'}` 
      }, { status: 400 });
    }

    // 模拟真伪校验（实际应调用税务局接口）
    // 5%几率服务不可用，85%验证通过，10%验证失败
    const random = Math.random();
    
    if (random < 0.05) {
      // 模拟服务不可用
      return NextResponse.json({ 
        error: '校验服务暂不可用，请稍后重试' 
      }, { status: 503 });
    }

    const isAuthentic = random > 0.15; // 85%几率验证通过
    const isInfoMismatch = !isAuthentic && random > 0.10; // 信息不符

    invoice.authenticityStatus = isAuthentic ? 'verified' : 'failed';
    invoice.authenticityVerifiedAt = now();
    invoice.updatedAt = now();

    if (!isAuthentic) {
      invoice.usable = false;
      invoice.unusableReason = isInfoMismatch 
        ? '信息不符：发票金额与税务系统记录不一致' 
        : '发票真伪校验未通过：发票不存在或已作废';
    }

    invoices[index] = invoice;
    await writeJsonFile(FILE_NAME, invoices);

    return NextResponse.json({
      ...invoice,
      message: isAuthentic ? '发票真伪校验通过，已标记为"已验真"' : `发票真伪校验失败：${invoice.unusableReason}`,
    });
  } catch (error) {
    console.error('发票真伪校验失败:', error);
    return NextResponse.json({ error: '发票真伪校验失败' }, { status: 500 });
  }
}
