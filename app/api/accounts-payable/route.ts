import { NextResponse } from 'next/server';
import { readJsonFile, AccountsPayable } from '@/lib/db';

const FILE_NAME = 'accounts-payable.json';

// GET /api/accounts-payable - 获取应付账款列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const paymentStatus = searchParams.get('paymentStatus');
    const verificationStatus = searchParams.get('verificationStatus');

    let payables = await readJsonFile<AccountsPayable>(FILE_NAME);

    if (supplierId) {
      payables = payables.filter(p => p.supplierId === supplierId);
    }
    if (paymentStatus) {
      payables = payables.filter(p => p.paymentStatus === paymentStatus);
    }
    if (verificationStatus) {
      payables = payables.filter(p => p.verificationStatus === verificationStatus);
    }

    payables.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(payables);
  } catch (error) {
    console.error('获取应付账款列表失败:', error);
    return NextResponse.json({ error: '获取应付账款列表失败' }, { status: 500 });
  }
}
