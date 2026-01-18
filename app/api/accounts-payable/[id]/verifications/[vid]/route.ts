import { NextResponse } from 'next/server';
import { readJsonFile, VerificationRecord } from '@/lib/db';

const VERIFICATIONS_FILE = 'verifications.json';

// GET /api/accounts-payable/[id]/verifications/[vid] - 获取核销记录详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  try {
    const { id, vid } = await params;
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);
    const verification = verifications.find(v => v.id === vid && v.payableId === id);

    if (!verification) {
      return NextResponse.json({ error: '核销记录不存在' }, { status: 404 });
    }

    return NextResponse.json(verification);
  } catch (error) {
    console.error('获取核销记录详情失败:', error);
    return NextResponse.json({ error: '获取核销记录详情失败' }, { status: 500 });
  }
}
