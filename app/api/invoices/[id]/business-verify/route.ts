import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile, now, Invoice } from '@/lib/db';

const FILE_NAME = 'invoices.json';

// POST /api/invoices/[id]/business-verify - 业务校验（标记可用/不可用）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { usable, unusableReason, verifiedBy } = body;

    const invoices = await readJsonFile<Invoice>(FILE_NAME);
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '发票不存在' }, { status: 404 });
    }

    const invoice = invoices[index];

    // 只有真伪校验通过的发票才能进行业务校验
    if (invoice.authenticityStatus !== 'verified') {
      return NextResponse.json({ error: '请先完成真伪校验' }, { status: 400 });
    }

    // 如果标记为不可用，必须填写原因
    if (!usable && (!unusableReason || unusableReason.length < 5)) {
      return NextResponse.json({ error: '请填写不可用原因（至少5个字符）' }, { status: 400 });
    }

    // 已核销的发票不能改为不可用
    if (!usable && invoice.verifiedAmount > 0) {
      return NextResponse.json({ error: '已有核销记录的发票不能标记为不可用' }, { status: 400 });
    }

    // 更新发票
    invoices[index] = {
      ...invoice,
      usable,
      unusableReason: usable ? undefined : unusableReason,
      verifiedAt: now(),
      verifiedBy: verifiedBy || '当前用户',
      updatedAt: now(),
    };

    await writeJsonFile(FILE_NAME, invoices);

    return NextResponse.json({
      message: usable ? '业务校验通过，发票可用' : '发票已标记为不可用',
      invoice: invoices[index],
    });
  } catch (error) {
    console.error('业务校验失败:', error);
    return NextResponse.json({ error: '业务校验失败' }, { status: 500 });
  }
}
