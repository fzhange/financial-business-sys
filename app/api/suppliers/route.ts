import { NextResponse } from 'next/server';
import { readJsonFile, Supplier } from '@/lib/db';

const FILE_NAME = 'suppliers.json';

// GET /api/suppliers - 获取供应商列表
export async function GET() {
  try {
    const suppliers = await readJsonFile<Supplier>(FILE_NAME);
    return NextResponse.json(suppliers.filter(s => s.status === 'active'));
  } catch (error) {
    console.error('获取供应商列表失败:', error);
    return NextResponse.json({ error: '获取供应商列表失败' }, { status: 500 });
  }
}
