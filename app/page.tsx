'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  FileText,
  Wallet,
  Receipt,
  FileCheck,
  CreditCard,
  ArrowRight,
} from 'lucide-react';

interface Stats {
  purchaseRecords: number;
  statements: number;
  payables: { total: number; unpaid: number };
  invoices: number;
  requests: { pending: number };
  orders: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    purchaseRecords: 0,
    statements: 0,
    payables: { total: 0, unpaid: 0 },
    invoices: 0,
    requests: { pending: 0 },
    orders: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [purchaseRes, statementsRes, payablesRes, invoicesRes, requestsRes, ordersRes] =
        await Promise.all([
          fetch('/api/purchase-records'),
          fetch('/api/supplier-statements'),
          fetch('/api/accounts-payable'),
          fetch('/api/invoices'),
          fetch('/api/payment-requests'),
          fetch('/api/payment-orders'),
        ]);

      const [purchaseRecords, statements, payables, invoices, requests, orders] = await Promise.all([
        purchaseRes.json(),
        statementsRes.json(),
        payablesRes.json(),
        invoicesRes.json(),
        requestsRes.json(),
        ordersRes.json(),
      ]);

      setStats({
        purchaseRecords: purchaseRecords.length,
        statements: statements.length,
        payables: {
          total: payables.length,
          unpaid: payables.filter((p: { paymentStatus: string }) => p.paymentStatus !== 'paid').length,
        },
        invoices: invoices.length,
        requests: {
          pending: requests.filter((r: { status: string }) => r.status === 'pending_approval').length,
        },
        orders: orders.length,
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const cards = [
    {
      title: '采购记录',
      value: stats.purchaseRecords,
      description: '入库/退货记录',
      icon: Package,
      href: '/purchase-records',
      color: 'bg-blue-500',
    },
    {
      title: '供应商对账',
      value: stats.statements,
      description: '对账单管理',
      icon: FileText,
      href: '/supplier-statements',
      color: 'bg-purple-500',
    },
    {
      title: '应付账款',
      value: `${stats.payables.total}`,
      description: `${stats.payables.unpaid} 笔待付款`,
      icon: Wallet,
      href: '/accounts-payable',
      color: 'bg-orange-500',
    },
    {
      title: '发票管理',
      value: stats.invoices,
      description: '发票录入与校验',
      icon: Receipt,
      href: '/invoices',
      color: 'bg-green-500',
    },
    {
      title: '请款管理',
      value: stats.requests.pending,
      description: '待审批请款单',
      icon: FileCheck,
      href: '/payment-requests',
      color: 'bg-yellow-500',
    },
    {
      title: '付款单',
      value: stats.orders,
      description: '付款记录',
      icon: CreditCard,
      href: '/payment-orders',
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">业务财务系统</h1>
        <p className="text-muted-foreground mt-2">
          供应商对账付款流程管理
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{card.value}</div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {card.description}
                    </p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>业务流程</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm overflow-x-auto pb-2">
            {[
              { label: '采购记录', href: '/purchase-records' },
              { label: '供应商对账', href: '/supplier-statements' },
              { label: '应付账款', href: '/accounts-payable' },
              { label: '发票管理', href: '/invoices' },
              { label: '请款审批', href: '/payment-requests' },
              { label: '付款执行', href: '/payment-orders' },
              { label: '三单核销', href: '/accounts-payable' },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center">
                <Link
                  href={step.href}
                  className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  {step.label}
                </Link>
                {index < 6 && (
                  <ArrowRight className="w-4 h-4 mx-2 text-gray-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
