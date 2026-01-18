'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, RotateCcw, Wand2 } from 'lucide-react';
import type { AccountsPayable, PaymentOrder, Invoice, VerificationRecord, PaymentOrderVerificationDetail, InvoiceVerificationDetail } from '@/lib/db';

interface PayableDetail extends AccountsPayable {
  paymentOrders: PaymentOrder[];
  invoices: Invoice[];
  verifications: VerificationRecord[];
  statementNo?: string; // 关联对账单号
}

const reverseReasonTypes = [
  { value: 'input_error', label: '录入错误' },
  { value: 'business_change', label: '业务变更' },
  { value: 'duplicate_verification', label: '重复核销' },
  { value: 'invoice_return', label: '发票退回' },
  { value: 'other', label: '其他' },
];

export default function AccountsPayableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [payable, setPayable] = useState<PayableDetail | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<VerificationRecord | null>(null);

  // 核销表单 - 支持多选和手动分配金额
  const [verifyForm, setVerifyForm] = useState({
    paymentOrderIds: [] as string[],
    invoiceIds: [] as string[],
    amount: 0,
    paymentOrderDetails: [] as PaymentOrderVerificationDetail[],
    invoiceDetails: [] as InvoiceVerificationDetail[],
  });

  // 冲销表单
  const [reverseForm, setReverseForm] = useState({
    reverseReasonType: '',
    reverseReasonDetail: '',
  });

  useEffect(() => {
    fetchPayable();
  }, [id]);

  const fetchPayable = async () => {
    const res = await fetch(`/api/accounts-payable/${id}`);
    const data = await res.json();
    setPayable(data);
  };

  const handleVerify = async () => {
    if (verifyForm.paymentOrderIds.length === 0 || verifyForm.invoiceIds.length === 0 || verifyForm.amount <= 0) {
      alert('请选择付款单、发票并填写核销金额');
      return;
    }

    const res = await fetch(`/api/accounts-payable/${id}/verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentOrderIds: verifyForm.paymentOrderIds,
        invoiceIds: verifyForm.invoiceIds,
        amount: verifyForm.amount,
        // 传递手动分配的明细
        paymentOrderDetails: verifyForm.paymentOrderDetails.filter(d => d.amount > 0),
        invoiceDetails: verifyForm.invoiceDetails.filter(d => d.amount > 0),
        verifiedBy: '当前用户',
      }),
    });

    if (res.ok) {
      setVerifyDialogOpen(false);
      setVerifyForm({ paymentOrderIds: [], invoiceIds: [], amount: 0, paymentOrderDetails: [], invoiceDetails: [] });
      fetchPayable();
    } else {
      const error = await res.json();
      alert(error.error);
    }
  };

  const handleReverse = async (approvalConfirmed = false) => {
    if (!selectedVerification) return;
    if (!reverseForm.reverseReasonType || reverseForm.reverseReasonDetail.length < 10) {
      alert('请选择冲销原因类型并填写详细说明（至少10个字符）');
      return;
    }

    const res = await fetch(`/api/accounts-payable/${id}/verifications/${selectedVerification.id}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reverseForm,
        reversedBy: '当前用户',
        approvalConfirmed,
      }),
    });

    if (res.ok) {
      setReverseDialogOpen(false);
      setSelectedVerification(null);
      setReverseForm({ reverseReasonType: '', reverseReasonDetail: '' });
      fetchPayable();
    } else {
      const error = await res.json();
      // 处理跨月冲销需要审批的情况
      if (error.requireApproval && error.crossMonth) {
        const confirmed = confirm(
          `该核销为跨月核销（核销月份：${error.verificationMonth}），需要财务主管审批确认。\n\n是否确认已获得审批授权？`
        );
        if (confirmed) {
          // 重新发起请求，带上审批确认标记
          handleReverse(true);
        }
      } else {
        alert(error.error);
      }
    }
  };

  // 计算可核销的最大金额（基于明细中的分配金额）
  const calculateMaxAmount = () => {
    if (!payable || verifyForm.paymentOrderIds.length === 0 || verifyForm.invoiceIds.length === 0) return 0;
    
    // 计算付款单明细的总分配金额
    const totalPaymentAmount = verifyForm.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
    
    // 计算发票明细的总分配金额
    const totalInvoiceAmount = verifyForm.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);
    
    return Math.min(payable.unverifiedAmount, totalPaymentAmount, totalInvoiceAmount);
  };

  // 切换付款单选择
  const togglePaymentOrder = (poId: string, checked: boolean) => {
    if (!payable) return;
    
    let newIds: string[];
    let newDetails: PaymentOrderVerificationDetail[];
    
    if (checked) {
      newIds = [...verifyForm.paymentOrderIds, poId];
      const po = payable.paymentOrders.find(p => p.id === poId);
      newDetails = [...verifyForm.paymentOrderDetails, { paymentOrderId: poId, amount: po?.unverifiedAmount || 0 }];
    } else {
      newIds = verifyForm.paymentOrderIds.filter((id) => id !== poId);
      newDetails = verifyForm.paymentOrderDetails.filter(d => d.paymentOrderId !== poId);
    }
    
    // 重新计算总金额
    const totalPoAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = verifyForm.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    setVerifyForm({ 
      ...verifyForm, 
      paymentOrderIds: newIds, 
      paymentOrderDetails: newDetails,
      amount: newAmount,
    });
  };

  // 切换发票选择
  const toggleInvoice = (invId: string, checked: boolean) => {
    if (!payable) return;
    
    let newIds: string[];
    let newDetails: InvoiceVerificationDetail[];
    
    if (checked) {
      newIds = [...verifyForm.invoiceIds, invId];
      const inv = payable.invoices.find(i => i.id === invId);
      newDetails = [...verifyForm.invoiceDetails, { invoiceId: invId, amount: inv?.unverifiedAmount || 0 }];
    } else {
      newIds = verifyForm.invoiceIds.filter((id) => id !== invId);
      newDetails = verifyForm.invoiceDetails.filter(d => d.invoiceId !== invId);
    }
    
    // 重新计算总金额
    const totalPoAmount = verifyForm.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    setVerifyForm({ 
      ...verifyForm, 
      invoiceIds: newIds, 
      invoiceDetails: newDetails,
      amount: newAmount,
    });
  };

  // 更新付款单明细金额
  const updatePaymentOrderDetailAmount = (poId: string, amount: number) => {
    if (!payable) return;
    
    const po = payable.paymentOrders.find(p => p.id === poId);
    const maxAmount = po?.unverifiedAmount || 0;
    const validAmount = Math.max(0, Math.min(amount, maxAmount));
    
    const newDetails = verifyForm.paymentOrderDetails.map(d => 
      d.paymentOrderId === poId ? { ...d, amount: validAmount } : d
    );
    
    // 重新计算总金额
    const totalPoAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = verifyForm.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    setVerifyForm({ ...verifyForm, paymentOrderDetails: newDetails, amount: newAmount });
  };

  // 更新发票明细金额
  const updateInvoiceDetailAmount = (invId: string, amount: number) => {
    if (!payable) return;
    
    const inv = payable.invoices.find(i => i.id === invId);
    const maxAmount = inv?.unverifiedAmount || 0;
    const validAmount = Math.max(0, Math.min(amount, maxAmount));
    
    const newDetails = verifyForm.invoiceDetails.map(d => 
      d.invoiceId === invId ? { ...d, amount: validAmount } : d
    );
    
    // 重新计算总金额
    const totalPoAmount = verifyForm.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    setVerifyForm({ ...verifyForm, invoiceDetails: newDetails, amount: newAmount });
  };

  // 自动分配最大金额
  const autoAllocate = () => {
    if (!payable || verifyForm.paymentOrderIds.length === 0 || verifyForm.invoiceIds.length === 0) return;
    
    // 计算最大可核销金额
    const totalPoAvailable = verifyForm.paymentOrderIds.reduce((sum, poId) => {
      const po = payable.paymentOrders.find(p => p.id === poId);
      return sum + (po?.unverifiedAmount || 0);
    }, 0);
    const totalInvAvailable = verifyForm.invoiceIds.reduce((sum, invId) => {
      const inv = payable.invoices.find(i => i.id === invId);
      return sum + (inv?.unverifiedAmount || 0);
    }, 0);
    const maxAmount = Math.min(payable.unverifiedAmount, totalPoAvailable, totalInvAvailable);
    
    // 按顺序分配付款单金额
    let remainingPo = maxAmount;
    const newPoDetails: PaymentOrderVerificationDetail[] = [];
    for (const poId of verifyForm.paymentOrderIds) {
      const po = payable.paymentOrders.find(p => p.id === poId);
      const available = po?.unverifiedAmount || 0;
      const allocated = Math.min(remainingPo, available);
      newPoDetails.push({ paymentOrderId: poId, amount: allocated });
      remainingPo -= allocated;
      if (remainingPo <= 0) break;
    }
    // 未分配完的付款单金额设为 0
    for (const poId of verifyForm.paymentOrderIds) {
      if (!newPoDetails.find(d => d.paymentOrderId === poId)) {
        newPoDetails.push({ paymentOrderId: poId, amount: 0 });
      }
    }
    
    // 按顺序分配发票金额
    let remainingInv = maxAmount;
    const newInvDetails: InvoiceVerificationDetail[] = [];
    for (const invId of verifyForm.invoiceIds) {
      const inv = payable.invoices.find(i => i.id === invId);
      const available = inv?.unverifiedAmount || 0;
      const allocated = Math.min(remainingInv, available);
      newInvDetails.push({ invoiceId: invId, amount: allocated });
      remainingInv -= allocated;
      if (remainingInv <= 0) break;
    }
    // 未分配完的发票金额设为 0
    for (const invId of verifyForm.invoiceIds) {
      if (!newInvDetails.find(d => d.invoiceId === invId)) {
        newInvDetails.push({ invoiceId: invId, amount: 0 });
      }
    }
    
    setVerifyForm({
      ...verifyForm,
      paymentOrderDetails: newPoDetails,
      invoiceDetails: newInvDetails,
      amount: maxAmount,
    });
  };

  if (!payable) {
    return <div className="p-6">加载中...</div>;
  }

  const availablePaymentOrders = payable.paymentOrders.filter(po => po.status === 'completed' && po.unverifiedAmount > 0);
  const availableInvoices = payable.invoices.filter(inv => inv.usable && inv.unverifiedAmount > 0);
  const maxAmount = calculateMaxAmount();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounts-payable">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">应付账款详情 - {payable.payableNo}</h1>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">供应商：</span>{payable.supplierName}</div>
            <div><span className="text-muted-foreground">应付金额：</span>¥{(payable.payableAmount ?? 0).toFixed(2)}</div>
            <div><span className="text-muted-foreground">已付金额：</span>¥{(payable.paidAmount ?? 0).toFixed(2)}</div>
            <div><span className="text-muted-foreground">未付金额：</span>¥{(payable.unpaidAmount ?? 0).toFixed(2)}</div>
            <div><span className="text-muted-foreground">已开票金额：</span>¥{(payable.invoicedAmount ?? 0).toFixed(2)}</div>
            <div><span className="text-muted-foreground">已核销金额：</span>¥{(payable.verifiedAmount ?? 0).toFixed(2)}</div>
            <div><span className="text-muted-foreground">未核销金额：</span>¥{(payable.unverifiedAmount ?? 0).toFixed(2)}</div>
            <div><span className="text-muted-foreground">到期日：</span>{payable.dueDate}</div>
            <div>
              <span className="text-muted-foreground">付款状态：</span>
              <Badge variant={payable.paymentStatus === 'paid' ? 'default' : payable.paymentStatus === 'partial_paid' ? 'secondary' : 'outline'} className="ml-1">
                {payable.paymentStatus === 'paid' ? '已付款' : payable.paymentStatus === 'partial_paid' ? '部分付款' : '未付款'}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">核销状态：</span>
              <Badge variant={payable.verificationStatus === 'verified' ? 'default' : payable.verificationStatus === 'partial_verified' ? 'secondary' : 'outline'} className="ml-1">
                {payable.verificationStatus === 'verified' ? '已核销' : payable.verificationStatus === 'partial_verified' ? '部分核销' : '未核销'}
              </Badge>
            </div>
            {payable.statementId && (
              <div className="col-span-2">
                <span className="text-muted-foreground">关联对账单：</span>
                <Link href={`/supplier-statements/${payable.statementId}`} className="text-primary hover:underline ml-1">
                  {payable.statementNo || payable.statementId}
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 三单核销 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>三单核销</CardTitle>
            <CardDescription>选择付款单、发票进行核销</CardDescription>
          </div>
          {payable.unverifiedAmount > 0 && (
            <Button onClick={() => setVerifyDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新增核销
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>核销单号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>付款单明细</TableHead>
                <TableHead>发票明细</TableHead>
                <TableHead className="text-right">核销金额</TableHead>
                <TableHead>核销日期</TableHead>
                <TableHead>核销人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payable.verifications.map(v => {
                // 使用明细信息（优先）或旧的 ID 列表（向后兼容）
                const paymentOrderDetailsDisplay = v.paymentOrderDetails && v.paymentOrderDetails.length > 0
                  ? v.paymentOrderDetails.map(d => {
                      const po = payable.paymentOrders.find(p => p.id === d.paymentOrderId);
                      return po ? `${po.orderNo}: ¥${d.amount.toFixed(2)}` : null;
                    }).filter(Boolean).join('\n')
                  : (v.paymentOrderIds || [v.paymentOrderId])
                      .map(poId => payable.paymentOrders.find(po => po.id === poId)?.orderNo)
                      .filter(Boolean)
                      .join(', ');

                const invoiceDetailsDisplay = v.invoiceDetails && v.invoiceDetails.length > 0
                  ? v.invoiceDetails.map(d => {
                      const inv = payable.invoices.find(i => i.id === d.invoiceId);
                      return inv ? `${inv.invoiceNo}: ¥${d.amount.toFixed(2)}` : null;
                    }).filter(Boolean).join('\n')
                  : (v.invoiceIds || [v.invoiceId])
                      .map(invId => payable.invoices.find(inv => inv.id === invId)?.invoiceNo)
                      .filter(Boolean)
                      .join(', ');

                // 判断核销类型：优先使用 verificationType，兼容旧数据
                const isAutoVerification = v.verificationType === 'auto' || v.verifiedBy === '系统自动核销';

                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.verificationNo}</TableCell>
                    <TableCell>
                      <Badge variant={isAutoVerification ? 'secondary' : 'outline'} className="text-xs">
                        {isAutoVerification ? '自动' : '手动'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48">
                      <div className="whitespace-pre-line text-xs" title={paymentOrderDetailsDisplay}>
                        {paymentOrderDetailsDisplay || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-48">
                      <div className="whitespace-pre-line text-xs" title={invoiceDetailsDisplay}>
                        {invoiceDetailsDisplay || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">¥{(v.amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{v.verificationDate}</TableCell>
                    <TableCell>{v.verifiedBy}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === 'completed' ? 'default' : 'destructive'}>
                        {v.status === 'completed' ? '已完成' : '已冲销'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedVerification(v);
                            setReverseDialogOpen(true);
                          }}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          冲销
                        </Button>
                      )}
                      {v.status === 'reversed' && (
                        <span className="text-xs text-muted-foreground">
                          {v.reversedBy} 于 {v.reversedAt?.split('T')[0]}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {payable.verifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    暂无核销记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 关联付款单 */}
      <Card>
        <CardHeader>
          <CardTitle>关联付款单</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>付款单号</TableHead>
                <TableHead className="text-right">付款金额</TableHead>
                <TableHead className="text-right">已核销金额</TableHead>
                <TableHead className="text-right">未核销金额</TableHead>
                <TableHead>付款方式</TableHead>
                <TableHead>付款日期</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payable.paymentOrders.map(po => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.orderNo}</TableCell>
                  <TableCell className="text-right">¥{po.paymentAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">¥{po.verifiedAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">¥{po.unverifiedAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    {po.paymentMethod === 'bank_transfer' ? '银行转账' :
                      po.paymentMethod === 'check' ? '支票' :
                        po.paymentMethod === 'cash' ? '现金' : '其他'}
                  </TableCell>
                  <TableCell>{po.paymentDate}</TableCell>
                  <TableCell>
                    <Badge variant={po.status === 'completed' ? 'default' : 'destructive'}>
                      {po.status === 'completed' ? '已完成' : '失败'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {payable.paymentOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暂无付款单
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 关联发票 */}
      <Card>
        <CardHeader>
          <CardTitle>可用发票</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>发票号码</TableHead>
                <TableHead>发票类型</TableHead>
                <TableHead className="text-right">价税合计</TableHead>
                <TableHead className="text-right">已核销金额</TableHead>
                <TableHead className="text-right">未核销金额</TableHead>
                <TableHead>开票日期</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payable.invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNo}</TableCell>
                  <TableCell>
                    {inv.invoiceType === 'vat_special' ? '增值税专用发票' :
                      inv.invoiceType === 'vat_normal' ? '增值税普通发票' : '其他'}
                  </TableCell>
                  <TableCell className="text-right">¥{inv.totalAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">¥{inv.verifiedAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">¥{inv.unverifiedAmount.toFixed(2)}</TableCell>
                  <TableCell>{inv.invoiceDate}</TableCell>
                  <TableCell>
                    <Badge variant={inv.verificationStatus === 'verified' ? 'default' :
                      inv.verificationStatus === 'partial_verified' ? 'secondary' : 'outline'}>
                      {inv.verificationStatus === 'verified' ? '已核销' :
                        inv.verificationStatus === 'partial_verified' ? '部分核销' : '未核销'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {payable.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暂无可用发票
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 核销弹窗 */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增核销</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 自动分配按钮 */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={autoAllocate}
                disabled={verifyForm.paymentOrderIds.length === 0 || verifyForm.invoiceIds.length === 0}
              >
                <Wand2 className="w-4 h-4 mr-1" />
                自动分配最大金额
              </Button>
            </div>

            {/* 付款单选择与分配 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>选择付款单并分配金额</Label>
                <span className="text-xs text-muted-foreground">
                  已分配：¥{verifyForm.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
                </span>
              </div>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {availablePaymentOrders.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-2">暂无可用付款单</div>
                ) : (
                  availablePaymentOrders.map(po => {
                    const detail = verifyForm.paymentOrderDetails.find(d => d.paymentOrderId === po.id);
                    const isSelected = verifyForm.paymentOrderIds.includes(po.id);
                    return (
                      <div key={po.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`po-${po.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => togglePaymentOrder(po.id, !!checked)}
                        />
                        <label htmlFor={`po-${po.id}`} className="text-sm cursor-pointer flex-1 min-w-0">
                          <span className="truncate">{po.orderNo}</span>
                          <span className="text-muted-foreground ml-1">
                            (可核销 ¥{po.unverifiedAmount.toFixed(2)})
                          </span>
                        </label>
                        {isSelected && (
                          <Input
                            type="number"
                            className="w-28 h-7 text-sm"
                            value={detail?.amount || 0}
                            onChange={(e) => updatePaymentOrderDetailAmount(po.id, Number(e.target.value))}
                            max={po.unverifiedAmount}
                            min={0}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 发票选择与分配 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>选择发票并分配金额</Label>
                <span className="text-xs text-muted-foreground">
                  已分配：¥{verifyForm.invoiceDetails.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
                </span>
              </div>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {availableInvoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-2">暂无可用发票</div>
                ) : (
                  availableInvoices.map(inv => {
                    const detail = verifyForm.invoiceDetails.find(d => d.invoiceId === inv.id);
                    const isSelected = verifyForm.invoiceIds.includes(inv.id);
                    return (
                      <div key={inv.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`inv-${inv.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleInvoice(inv.id, !!checked)}
                        />
                        <label htmlFor={`inv-${inv.id}`} className="text-sm cursor-pointer flex-1 min-w-0">
                          <span className="truncate">{inv.invoiceNo}</span>
                          <span className="text-muted-foreground ml-1">
                            (可核销 ¥{inv.unverifiedAmount.toFixed(2)})
                          </span>
                        </label>
                        {isSelected && (
                          <Input
                            type="number"
                            className="w-28 h-7 text-sm"
                            value={detail?.amount || 0}
                            onChange={(e) => updateInvoiceDetailAmount(inv.id, Number(e.target.value))}
                            max={inv.unverifiedAmount}
                            min={0}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 核销金额汇总 */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span>付款单分配合计：</span>
                <span className="font-medium">¥{verifyForm.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>发票分配合计：</span>
                <span className="font-medium">¥{verifyForm.invoiceDetails.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
                <span className="font-medium">本次核销金额：</span>
                <span className="font-bold text-lg">¥{maxAmount.toFixed(2)}</span>
              </div>
              {verifyForm.paymentOrderDetails.length > 0 && verifyForm.invoiceDetails.length > 0 && 
               verifyForm.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0) !== 
               verifyForm.invoiceDetails.reduce((sum, d) => sum + d.amount, 0) && (
                <div className="text-xs text-amber-600">
                  提示：付款单与发票的分配金额不相等，将取较小值作为核销金额
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>取消</Button>
              <Button onClick={handleVerify} disabled={maxAmount <= 0}>确认核销</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 冲销弹窗 */}
      <Dialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>冲销核销记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              确定要冲销核销单 {selectedVerification?.verificationNo} 吗？
              <br />
              核销金额：¥{(selectedVerification?.amount ?? 0).toFixed(2)}
            </div>
            <div className="space-y-2">
              <Label>冲销原因类型 *</Label>
              <Select
                value={reverseForm.reverseReasonType}
                onValueChange={(v) => setReverseForm({ ...reverseForm, reverseReasonType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择冲销原因" />
                </SelectTrigger>
                <SelectContent>
                  {reverseReasonTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>详细说明 *（至少10个字符）</Label>
              <Input
                value={reverseForm.reverseReasonDetail}
                onChange={(e) => setReverseForm({ ...reverseForm, reverseReasonDetail: e.target.value })}
                placeholder="请详细说明冲销原因"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReverseDialogOpen(false)}>取消</Button>
              <Button variant="destructive" onClick={() => handleReverse()}>确认冲销</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
