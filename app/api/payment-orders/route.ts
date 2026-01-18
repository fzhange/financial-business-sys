import { NextResponse } from 'next/server';
import { readJsonFile, PaymentOrder, VerificationRecord } from '@/lib/db';

const FILE_NAME = 'payment-orders.json';
const VERIFICATIONS_FILE = 'verifications.json';

// GET /api/payment-orders - 获取付款单列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');
    const payableId = searchParams.get('payableId');

    let orders = await readJsonFile<PaymentOrder>(FILE_NAME);
    const verifications = await readJsonFile<VerificationRecord>(VERIFICATIONS_FILE);

    if (supplierId) {
      orders = orders.filter(o => o.supplierId === supplierId);
    }
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    if (payableId) {
      orders = orders.filter(o => o.payableId === payableId);
    }

    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 为每个付款单添加核销类型信息
    const ordersWithVerificationType = orders.map(order => {
      // 查找该付款单参与的核销记录
      const relatedVerifications = verifications.filter(v => 
        v.status === 'completed' && 
        (v.paymentOrderId === order.id || v.paymentOrderIds?.includes(order.id))
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
        ...order,
        lastVerificationType,
      };
    });

    return NextResponse.json(ordersWithVerificationType);
  } catch (error) {
    console.error('获取付款单列表失败:', error);
    return NextResponse.json({ error: '获取付款单列表失败' }, { status: 500 });
  }
}
