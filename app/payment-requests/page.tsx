'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Send, Check, X, CreditCard } from 'lucide-react';
import type { PaymentRequest, Supplier, AccountsPayable, Invoice } from '@/lib/db';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: '草稿', variant: 'outline' },
  pending_approval: { label: '待审批', variant: 'secondary' },
  approved: { label: '已审批', variant: 'default' },
  rejected: { label: '已拒绝', variant: 'destructive' },
  paid: { label: '已付款', variant: 'default' },
};

export default function PaymentRequestsPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  
  // 筛选状态
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');

  const [formData, setFormData] = useState({
    supplierId: '',
    supplierName: '',
    payableId: '',
    invoiceId: '',
    requestAmount: 0,
    requestReason: '',
  });

  const [approvalData, setApprovalData] = useState({
    approved: true,
    approvalRemarks: '',
  });

  const [payData, setPayData] = useState({
    paymentAmount: 0,
    paymentMethod: 'bank_transfer' as 'bank_transfer' | 'check' | 'cash' | 'other',
    bankAccount: '',
    bankName: '',
    transactionNo: '',
    remarks: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [requestsRes, suppliersRes, payablesRes, invoicesRes] = await Promise.all([
      fetch('/api/payment-requests'),
      fetch('/api/suppliers'),
      fetch('/api/accounts-payable'),
      fetch('/api/invoices'),
    ]);
    setRequests(await requestsRes.json());
    setSuppliers(await suppliersRes.json());
    setPayables(await payablesRes.json());
    setInvoices(await invoicesRes.json());
  };

  const handleSubmit = async () => {
    if (!formData.supplierId || formData.requestAmount <= 0) {
      alert('请填写完整信息');
      return;
    }
    if (!formData.invoiceId) {
      alert('请款必须关联至少一张已校验发票');
      return;
    }

    const res = await fetch('/api/payment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        payableIds: formData.payableId ? [formData.payableId] : [],
        invoiceIds: formData.invoiceId ? [formData.invoiceId] : [],
      }),
    });

    if (res.ok) {
      setDialogOpen(false);
      fetchData();
      resetForm();
    } else {
      const error = await res.json();
      alert(error.error);
    }
  };

  const handleSendApproval = async (id: string) => {
    const res = await fetch(`/api/payment-requests/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedBy: '当前用户' }),
    });

    if (res.ok) {
      fetchData();
    }
  };

  const handleApproval = async () => {
    if (!selectedRequest) return;

    const res = await fetch(`/api/payment-requests/${selectedRequest.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...approvalData,
        approvedBy: '当前用户',
      }),
    });

    if (res.ok) {
      setApprovalDialogOpen(false);
      fetchData();
    }
  };

  const handlePay = async () => {
    if (!selectedRequest) return;
    if (payData.paymentAmount <= 0) {
      alert('请输入付款金额');
      return;
    }

    const res = await fetch(`/api/payment-requests/${selectedRequest.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payData,
        payableId: selectedRequest.payableIds[0],
      }),
    });

    if (res.ok) {
      const result = await res.json();
      setPayDialogOpen(false);
      fetchData();
      // 显示自动核销结果
      if (result.autoVerification) {
        alert(`${result.message}\n核销单号：${result.autoVerification.verificationNo}`);
      } else {
        alert(result.message || '付款成功');
      }
    } else {
      const error = await res.json();
      alert(error.error);
    }
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      supplierName: '',
      payableId: '',
      invoiceId: '',
      requestAmount: 0,
      requestReason: '',
    });
  };

  // 根据选中的供应商筛选
  const filteredPayables = payables.filter(p => p.supplierId === formData.supplierId && p.unpaidAmount > 0);
  const filteredInvoices = invoices.filter(inv => inv.supplierId === formData.supplierId && inv.usable);

  // 列表筛选
  const filteredRequests = requests.filter(req => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    if (filterSupplierId !== 'all' && req.supplierId !== filterSupplierId) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">请款管理</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              新建请款单
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>新建请款单</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>供应商 *</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(v) => {
                    const supplier = suppliers.find(s => s.id === v);
                    setFormData({
                      ...formData,
                      supplierId: v,
                      supplierName: supplier?.name || '',
                      payableId: '',
                      invoiceId: '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关联应付账款</Label>
                <Select
                  value={formData.payableId || 'none'}
                  onValueChange={(v) => {
                    const payable = filteredPayables.find(p => p.id === v);
                    setFormData({
                      ...formData,
                      payableId: v === 'none' ? '' : v,
                      requestAmount: payable?.unpaidAmount || formData.requestAmount,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择应付账款（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联</SelectItem>
                    {filteredPayables.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.payableNo} - 未付 ¥{p.unpaidAmount.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关联发票 *</Label>
                <Select
                  value={formData.invoiceId || 'none'}
                  onValueChange={(v) => {
                    const invoice = filteredInvoices.find(inv => inv.id === v);
                    setFormData({ 
                      ...formData, 
                      invoiceId: v === 'none' ? '' : v,
                      // 自动填充发票金额作为请款金额
                      requestAmount: invoice ? invoice.totalAmount : formData.requestAmount,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择发票" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择发票</SelectItem>
                    {filteredInvoices.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoiceNo} - ¥{inv.totalAmount.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>请款金额 *</Label>
                <Input
                  type="number"
                  value={formData.requestAmount}
                  onChange={(e) => setFormData({ ...formData, requestAmount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>请款事由</Label>
                <Input
                  value={formData.requestReason}
                  onChange={(e) => setFormData({ ...formData, requestReason: e.target.value })}
                  placeholder="请输入请款事由"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button onClick={handleSubmit}>保存</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="pending_approval">待审批</SelectItem>
                <SelectItem value="approved">已审批</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSupplierId} onValueChange={setFilterSupplierId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="供应商筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部供应商</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>请款单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead className="text-right">请款金额</TableHead>
                <TableHead className="text-right">已批金额</TableHead>
                <TableHead>申请人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map(req => (
                <TableRow 
                  key={req.id}
                  className={req.status === 'pending_approval' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                >
                  <TableCell className="font-medium">{req.requestNo}</TableCell>
                  <TableCell>{req.supplierName}</TableCell>
                  <TableCell className="text-right">¥{req.requestAmount.toFixed(2)}</TableCell>
                  <TableCell>{req.submittedBy || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[req.status]?.variant || 'outline'}>
                      {statusMap[req.status]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {req.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendApproval(req.id)}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          提交
                        </Button>
                      )}
                      {req.status === 'pending_approval' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(req);
                            setApprovalData({ approved: true, approvalRemarks: '' });
                            setApprovalDialogOpen(true);
                          }}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          审批
                        </Button>
                      )}
                      {req.status === 'approved' && req.unpaidAmount > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(req);
                            const payable = payables.find(p => p.id === req.payableIds[0]);
                            setPayData({
                              paymentAmount: req.unpaidAmount,
                              paymentMethod: 'bank_transfer',
                              bankAccount: payable ? suppliers.find(s => s.id === payable.supplierId)?.bankAccount || '' : '',
                              bankName: payable ? suppliers.find(s => s.id === payable.supplierId)?.bankName || '' : '',
                              transactionNo: '',
                              remarks: '',
                            });
                            setPayDialogOpen(true);
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          付款
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 审批弹窗 */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审批请款单 - {selectedRequest?.requestNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <div>供应商：{selectedRequest?.supplierName}</div>
              <div>请款金额：¥{selectedRequest?.requestAmount.toFixed(2)}</div>
            </div>
            <div className="space-y-2">
              <Label>审批意见</Label>
              <Input
                value={approvalData.approvalRemarks}
                onChange={(e) => setApprovalData({ ...approvalData, approvalRemarks: e.target.value })}
                placeholder="请输入审批意见（可选）"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  setApprovalData({ ...approvalData, approved: false });
                  handleApproval();
                }}
              >
                <X className="w-4 h-4 mr-1" />
                拒绝
              </Button>
              <Button
                onClick={() => {
                  setApprovalData({ ...approvalData, approved: true });
                  handleApproval();
                }}
              >
                <Check className="w-4 h-4 mr-1" />
                通过
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 付款弹窗 */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发起付款 - {selectedRequest?.requestNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              未付金额：¥{selectedRequest?.unpaidAmount.toFixed(2)}
            </div>
            <div className="space-y-2">
              <Label>付款金额 *</Label>
              <Input
                type="number"
                value={payData.paymentAmount}
                onChange={(e) => setPayData({ ...payData, paymentAmount: Number(e.target.value) })}
                max={selectedRequest?.unpaidAmount}
              />
            </div>
            <div className="space-y-2">
              <Label>付款方式</Label>
              <Select
                value={payData.paymentMethod}
                onValueChange={(v) => setPayData({ ...payData, paymentMethod: v as typeof payData.paymentMethod })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>收款账号</Label>
              <Input
                value={payData.bankAccount}
                onChange={(e) => setPayData({ ...payData, bankAccount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>收款银行</Label>
              <Input
                value={payData.bankName}
                onChange={(e) => setPayData({ ...payData, bankName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>交易流水号</Label>
              <Input
                value={payData.transactionNo}
                onChange={(e) => setPayData({ ...payData, transactionNo: e.target.value })}
                placeholder="请输入银行交易流水号（可选）"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>取消</Button>
              <Button onClick={handlePay}>确认付款</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
