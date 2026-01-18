'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, CheckSquare } from 'lucide-react';
import type { AccountsPayable } from '@/lib/db';
import { BatchVerificationDialog } from './batch-verification-dialog';

const paymentStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  unpaid: { label: '未付款', variant: 'outline' },
  partial_paid: { label: '部分付款', variant: 'secondary' },
  paid: { label: '已付款', variant: 'default' },
};

const verificationStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  unverified: { label: '未核销', variant: 'outline' },
  partial_verified: { label: '部分核销', variant: 'secondary' },
  verified: { label: '已核销', variant: 'default' },
};

export default function AccountsPayablePage() {
  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  const [filterVerificationStatus, setFilterVerificationStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchVerifyDialogOpen, setBatchVerifyDialogOpen] = useState(false);

  useEffect(() => {
    fetchPayables();
  }, []);

  const fetchPayables = async () => {
    const res = await fetch('/api/accounts-payable');
    const data = await res.json();
    setPayables(data);
  };

  const filteredPayables = payables.filter(p => {
    if (filterPaymentStatus !== 'all' && p.paymentStatus !== filterPaymentStatus) return false;
    if (filterVerificationStatus !== 'all' && p.verificationStatus !== filterVerificationStatus) return false;
    return true;
  });

  // 可选（未核销完成）的应付单
  const selectablePayables = filteredPayables.filter(p => p.verificationStatus !== 'verified');
  const allSelectableSelected = selectablePayables.length > 0 && selectablePayables.every(p => selectedIds.includes(p.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(selectablePayables.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const selectedPayables = payables.filter(p => selectedIds.includes(p.id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">应付账款</h1>
        {selectedIds.length > 0 && (
          <Button onClick={() => setBatchVerifyDialogOpen(true)}>
            <CheckSquare className="w-4 h-4 mr-2" />
            批量核销 ({selectedIds.length})
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="付款状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部付款</SelectItem>
                <SelectItem value="unpaid">未付款</SelectItem>
                <SelectItem value="partial_paid">部分付款</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelectableSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>应付单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead className="text-right">应付金额</TableHead>
                <TableHead className="text-right">已付金额</TableHead>
                <TableHead className="text-right">未付金额</TableHead>
                <TableHead className="text-right">已核销金额</TableHead>
                <TableHead className="text-right">未核销金额</TableHead>
                <TableHead>付款状态</TableHead>
                <TableHead>核销状态</TableHead>
                <TableHead>到期日</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayables.map(payable => {
                const isSelectable = payable.verificationStatus !== 'verified';
                return (
                  <TableRow key={payable.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(payable.id)}
                        onCheckedChange={(checked) => handleSelectOne(payable.id, !!checked)}
                        disabled={!isSelectable}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{payable.payableNo}</TableCell>
                    <TableCell>{payable.supplierName}</TableCell>
                    <TableCell className="text-right">¥{payable.payableAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">¥{payable.paidAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">¥{payable.unpaidAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">¥{payable.verifiedAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">¥{payable.unverifiedAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={paymentStatusMap[payable.paymentStatus]?.variant || 'outline'}>
                        {paymentStatusMap[payable.paymentStatus]?.label || payable.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={verificationStatusMap[payable.verificationStatus]?.variant || 'outline'}>
                        {verificationStatusMap[payable.verificationStatus]?.label || payable.verificationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{payable.dueDate}</TableCell>
                    <TableCell>
                      <Link href={`/accounts-payable/${payable.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          详情
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredPayables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BatchVerificationDialog
        open={batchVerifyDialogOpen}
        onOpenChange={setBatchVerifyDialogOpen}
        payables={selectedPayables}
        onSuccess={() => {
          setSelectedIds([]);
          fetchPayables();
        }}
      />
    </div>
  );
}
