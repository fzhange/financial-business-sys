'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaymentOrder } from '@/lib/db';

interface PaymentOrderWithVerificationType extends PaymentOrder {
  lastVerificationType?: 'auto' | 'manual' | null;
}

const paymentMethodMap: Record<string, string> = {
  bank_transfer: '银行转账',
  check: '支票',
  cash: '现金',
  other: '其他',
};

const statusMap: Record<string, { label: string; variant: 'default' | 'destructive' }> = {
  completed: { label: '已完成', variant: 'default' },
  failed: { label: '付款失败', variant: 'destructive' },
};

const verificationStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  unverified: { label: '未核销', variant: 'outline' },
  partial_verified: { label: '部分核销', variant: 'secondary' },
  verified: { label: '已核销', variant: 'default' },
};

export default function PaymentOrdersPage() {
  const [orders, setOrders] = useState<PaymentOrderWithVerificationType[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterVerificationStatus, setFilterVerificationStatus] = useState<string>('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const res = await fetch('/api/payment-orders');
    const data = await res.json();
    setOrders(data);
  };

  const filteredOrders = orders.filter(order => {
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    if (filterVerificationStatus !== 'all' && order.verificationStatus !== filterVerificationStatus) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">付款单</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="付款状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="failed">付款失败</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterVerificationStatus} onValueChange={setFilterVerificationStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="核销状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部核销</SelectItem>
                <SelectItem value="unverified">未核销</SelectItem>
                <SelectItem value="partial_verified">部分核销</SelectItem>
                <SelectItem value="verified">已核销</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>付款单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead className="text-right">付款金额</TableHead>
                <TableHead className="text-right">已核销金额</TableHead>
                <TableHead className="text-right">未核销金额</TableHead>
                <TableHead>付款方式</TableHead>
                <TableHead>收款账号</TableHead>
                <TableHead>收款银行</TableHead>
                <TableHead>付款日期</TableHead>
                <TableHead>交易流水号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>核销状态</TableHead>
                <TableHead>核销类型</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.supplierName}</TableCell>
                  <TableCell className="text-right">¥{order.paymentAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">¥{(order.verifiedAmount || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">¥{(order.unverifiedAmount || order.paymentAmount).toFixed(2)}</TableCell>
                  <TableCell>{paymentMethodMap[order.paymentMethod]}</TableCell>
                  <TableCell>{order.bankAccount || '-'}</TableCell>
                  <TableCell>{order.bankName || '-'}</TableCell>
                  <TableCell>{order.paymentDate}</TableCell>
                  <TableCell>{order.transactionNo || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[order.status]?.variant || 'default'}>
                      {statusMap[order.status]?.label || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={verificationStatusMap[order.verificationStatus]?.variant || 'outline'}>
                      {verificationStatusMap[order.verificationStatus]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.lastVerificationType ? (
                      <Badge variant={order.lastVerificationType === 'auto' ? 'secondary' : 'outline'} className="text-xs">
                        {order.lastVerificationType === 'auto' ? '自动' : '手动'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
