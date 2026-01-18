'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import type { AccountsPayable, PaymentOrder, Invoice, PaymentOrderVerificationDetail, InvoiceVerificationDetail } from '@/lib/db';

interface PayableWithDetails extends AccountsPayable {
  paymentOrders: PaymentOrder[];
  invoices: Invoice[];
}

interface BatchVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payables: AccountsPayable[];
  onSuccess: () => void;
}

interface PayableVerifyConfig {
  payableId: string;
  paymentOrderIds: string[];
  invoiceIds: string[];
  amount: number;
  // 新增：手动分配的明细
  paymentOrderDetails: PaymentOrderVerificationDetail[];
  invoiceDetails: InvoiceVerificationDetail[];
}

export function BatchVerificationDialog({
  open,
  onOpenChange,
  payables,
  onSuccess,
}: BatchVerificationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payablesWithDetails, setPayablesWithDetails] = useState<PayableWithDetails[]>([]);
  const [configs, setConfigs] = useState<Map<string, PayableVerifyConfig>>(new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 加载每个应付单的详情（付款单、发票）
  useEffect(() => {
    if (open && payables.length > 0) {
      loadPayableDetails();
    }
  }, [open, payables]);

  const loadPayableDetails = async () => {
    setLoading(true);
    try {
      const details = await Promise.all(
        payables.map(async (p) => {
          const res = await fetch(`/api/accounts-payable/${p.id}`);
          return res.json();
        })
      );
      setPayablesWithDetails(details);
      // 初始化配置：默认展开所有，默认不选择任何付款单/发票
      const newConfigs = new Map<string, PayableVerifyConfig>();
      const newExpanded = new Set<string>();
      details.forEach((p: PayableWithDetails) => {
        newExpanded.add(p.id);
        newConfigs.set(p.id, {
          payableId: p.id,
          paymentOrderIds: [],
          invoiceIds: [],
          amount: 0,
          paymentOrderDetails: [],
          invoiceDetails: [],
        });
      });
      setExpandedIds(newExpanded);
      setConfigs(newConfigs);
    } catch (error) {
      console.error('加载应付单详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const updateConfig = (payableId: string, updates: Partial<PayableVerifyConfig>) => {
    const newConfigs = new Map(configs);
    const current = newConfigs.get(payableId) || {
      payableId,
      paymentOrderIds: [],
      invoiceIds: [],
      amount: 0,
      paymentOrderDetails: [],
      invoiceDetails: [],
    };
    newConfigs.set(payableId, { ...current, ...updates });
    setConfigs(newConfigs);
  };

  const togglePaymentOrder = (payableId: string, poId: string, checked: boolean, payable: PayableWithDetails) => {
    const config = configs.get(payableId);
    if (!config) return;
    
    let newIds: string[];
    let newDetails: PaymentOrderVerificationDetail[];
    
    if (checked) {
      newIds = [...config.paymentOrderIds, poId];
      const po = payable.paymentOrders.find(p => p.id === poId);
      newDetails = [...config.paymentOrderDetails, { paymentOrderId: poId, amount: po?.unverifiedAmount || 0 }];
    } else {
      newIds = config.paymentOrderIds.filter((id) => id !== poId);
      newDetails = config.paymentOrderDetails.filter(d => d.paymentOrderId !== poId);
    }
    
    // 重新计算总金额
    const totalPoAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = config.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    updateConfig(payableId, { 
      paymentOrderIds: newIds, 
      paymentOrderDetails: newDetails,
      amount: newAmount,
    });
  };

  const toggleInvoice = (payableId: string, invId: string, checked: boolean, payable: PayableWithDetails) => {
    const config = configs.get(payableId);
    if (!config) return;
    
    let newIds: string[];
    let newDetails: InvoiceVerificationDetail[];
    
    if (checked) {
      newIds = [...config.invoiceIds, invId];
      const inv = payable.invoices.find(i => i.id === invId);
      newDetails = [...config.invoiceDetails, { invoiceId: invId, amount: inv?.unverifiedAmount || 0 }];
    } else {
      newIds = config.invoiceIds.filter((id) => id !== invId);
      newDetails = config.invoiceDetails.filter(d => d.invoiceId !== invId);
    }
    
    // 重新计算总金额
    const totalPoAmount = config.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    updateConfig(payableId, { 
      invoiceIds: newIds, 
      invoiceDetails: newDetails,
      amount: newAmount,
    });
  };

  // 更新付款单明细金额
  const updatePaymentOrderDetailAmount = (payableId: string, poId: string, amount: number, payable: PayableWithDetails) => {
    const config = configs.get(payableId);
    if (!config) return;
    
    const po = payable.paymentOrders.find(p => p.id === poId);
    const maxAmount = po?.unverifiedAmount || 0;
    const validAmount = Math.max(0, Math.min(amount, maxAmount));
    
    const newDetails = config.paymentOrderDetails.map(d => 
      d.paymentOrderId === poId ? { ...d, amount: validAmount } : d
    );
    
    // 重新计算总金额
    const totalPoAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = config.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    updateConfig(payableId, { paymentOrderDetails: newDetails, amount: newAmount });
  };

  // 更新发票明细金额
  const updateInvoiceDetailAmount = (payableId: string, invId: string, amount: number, payable: PayableWithDetails) => {
    const config = configs.get(payableId);
    if (!config) return;
    
    const inv = payable.invoices.find(i => i.id === invId);
    const maxAmount = inv?.unverifiedAmount || 0;
    const validAmount = Math.max(0, Math.min(amount, maxAmount));
    
    const newDetails = config.invoiceDetails.map(d => 
      d.invoiceId === invId ? { ...d, amount: validAmount } : d
    );
    
    // 重新计算总金额
    const totalPoAmount = config.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = newDetails.reduce((sum, d) => sum + d.amount, 0);
    const newAmount = Math.min(totalPoAmount, totalInvAmount, payable.unverifiedAmount);
    
    updateConfig(payableId, { invoiceDetails: newDetails, amount: newAmount });
  };

  // 计算某个应付单的最大可核销金额
  const calculateMaxAmount = (payable: PayableWithDetails, config: PayableVerifyConfig) => {
    if (config.paymentOrderIds.length === 0 || config.invoiceIds.length === 0) return 0;
    const totalPaymentAmount = config.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvoiceAmount = config.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);
    return Math.min(payable.unverifiedAmount, totalPaymentAmount, totalInvoiceAmount);
  };

  // 自动分配金额（按比例）
  const autoAllocate = (payableId: string, payable: PayableWithDetails) => {
    const config = configs.get(payableId);
    if (!config || config.paymentOrderIds.length === 0 || config.invoiceIds.length === 0) return;
    
    // 计算最大可核销金额
    const totalPoAvailable = config.paymentOrderIds.reduce((sum, poId) => {
      const po = payable.paymentOrders.find(p => p.id === poId);
      return sum + (po?.unverifiedAmount || 0);
    }, 0);
    const totalInvAvailable = config.invoiceIds.reduce((sum, invId) => {
      const inv = payable.invoices.find(i => i.id === invId);
      return sum + (inv?.unverifiedAmount || 0);
    }, 0);
    const maxAmount = Math.min(payable.unverifiedAmount, totalPoAvailable, totalInvAvailable);
    
    // 按顺序分配付款单金额
    let remainingPo = maxAmount;
    const newPoDetails: PaymentOrderVerificationDetail[] = [];
    for (const poId of config.paymentOrderIds) {
      const po = payable.paymentOrders.find(p => p.id === poId);
      const available = po?.unverifiedAmount || 0;
      const allocated = Math.min(remainingPo, available);
      newPoDetails.push({ paymentOrderId: poId, amount: allocated });
      remainingPo -= allocated;
      if (remainingPo <= 0) break;
    }
    // 未分配完的付款单金额设为 0
    for (const poId of config.paymentOrderIds) {
      if (!newPoDetails.find(d => d.paymentOrderId === poId)) {
        newPoDetails.push({ paymentOrderId: poId, amount: 0 });
      }
    }
    
    // 按顺序分配发票金额
    let remainingInv = maxAmount;
    const newInvDetails: InvoiceVerificationDetail[] = [];
    for (const invId of config.invoiceIds) {
      const inv = payable.invoices.find(i => i.id === invId);
      const available = inv?.unverifiedAmount || 0;
      const allocated = Math.min(remainingInv, available);
      newInvDetails.push({ invoiceId: invId, amount: allocated });
      remainingInv -= allocated;
      if (remainingInv <= 0) break;
    }
    // 未分配完的发票金额设为 0
    for (const invId of config.invoiceIds) {
      if (!newInvDetails.find(d => d.invoiceId === invId)) {
        newInvDetails.push({ invoiceId: invId, amount: 0 });
      }
    }
    
    updateConfig(payableId, {
      paymentOrderDetails: newPoDetails,
      invoiceDetails: newInvDetails,
      amount: maxAmount,
    });
  };

  // 检查配置是否有效
  const isConfigValid = (config: PayableVerifyConfig) => {
    if (config.paymentOrderIds.length === 0 || config.invoiceIds.length === 0) return false;
    const totalPoAmount = config.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
    const totalInvAmount = config.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);
    // 付款单和发票的分配金额都要等于总核销金额
    return config.amount > 0 && 
           totalPoAmount >= config.amount && 
           totalInvAmount >= config.amount;
  };

  // 检查是否有有效的核销配置
  const getValidConfigs = () => {
    return Array.from(configs.values()).filter(isConfigValid);
  };

  const handleSubmit = async () => {
    const validConfigs = getValidConfigs();
    if (validConfigs.length === 0) {
      alert('请至少为一个应付单配置有效的核销信息');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/accounts-payable/batch-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verifications: validConfigs.map(c => ({
            payableId: c.payableId,
            paymentOrderIds: c.paymentOrderIds,
            invoiceIds: c.invoiceIds,
            amount: c.amount,
            // 传递手动分配的明细
            paymentOrderDetails: c.paymentOrderDetails.filter(d => d.amount > 0),
            invoiceDetails: c.invoiceDetails.filter(d => d.amount > 0),
          })),
          verifiedBy: '当前用户',
        }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`批量核销成功！共核销 ${result.successCount} 个应付单`);
        onOpenChange(false);
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.error || '批量核销失败');
      }
    } catch (error) {
      console.error('批量核销失败:', error);
      alert('批量核销失败');
    } finally {
      setSubmitting(false);
    }
  };

  const validCount = getValidConfigs().length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>批量核销 - {payables.length} 个应付单</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>加载中...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {payablesWithDetails.map((payable) => {
              const config = configs.get(payable.id) || {
                payableId: payable.id,
                paymentOrderIds: [],
                invoiceIds: [],
                amount: 0,
                paymentOrderDetails: [],
                invoiceDetails: [],
              };
              const availablePaymentOrders = payable.paymentOrders.filter(
                (po) => po.status === 'completed' && po.unverifiedAmount > 0
              );
              const availableInvoices = payable.invoices.filter(
                (inv) => inv.usable && inv.unverifiedAmount > 0
              );
              const maxAmount = calculateMaxAmount(payable, config);
              const isExpanded = expandedIds.has(payable.id);
              const configValid = isConfigValid(config);

              // 计算汇总
              const totalPoAllocated = config.paymentOrderDetails.reduce((sum, d) => sum + d.amount, 0);
              const totalInvAllocated = config.invoiceDetails.reduce((sum, d) => sum + d.amount, 0);

              return (
                <Card key={payable.id} className={configValid ? 'border-green-500' : ''}>
                  <CardHeader
                    className="cursor-pointer py-3"
                    onClick={() => toggleExpand(payable.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{payable.payableNo}</CardTitle>
                        <Badge variant="outline">{payable.supplierName}</Badge>
                        {configValid && (
                          <Badge variant="default" className="bg-green-600">
                            已配置 ¥{config.amount.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          未核销：¥{payable.unverifiedAmount.toFixed(2)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      {/* 自动分配按钮 */}
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            autoAllocate(payable.id, payable);
                          }}
                          disabled={config.paymentOrderIds.length === 0 || config.invoiceIds.length === 0}
                        >
                          <Wand2 className="w-4 h-4 mr-1" />
                          自动分配最大金额
                        </Button>
                      </div>

                      {/* 付款单选择与分配 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">选择付款单并分配金额</Label>
                          <span className="text-xs text-muted-foreground">
                            已分配：¥{totalPoAllocated.toFixed(2)}
                          </span>
                        </div>
                        <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                          {availablePaymentOrders.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-2">
                              暂无可用付款单
                            </div>
                          ) : (
                            availablePaymentOrders.map((po) => {
                              const detail = config.paymentOrderDetails.find(d => d.paymentOrderId === po.id);
                              const isSelected = config.paymentOrderIds.includes(po.id);
                              return (
                                <div key={po.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${payable.id}-po-${po.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      togglePaymentOrder(payable.id, po.id, !!checked, payable)
                                    }
                                  />
                                  <label
                                    htmlFor={`${payable.id}-po-${po.id}`}
                                    className="text-sm cursor-pointer flex-1 min-w-0"
                                  >
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
                                      onChange={(e) => updatePaymentOrderDetailAmount(
                                        payable.id, po.id, Number(e.target.value), payable
                                      )}
                                      onClick={(e) => e.stopPropagation()}
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
                          <Label className="text-sm font-medium">选择发票并分配金额</Label>
                          <span className="text-xs text-muted-foreground">
                            已分配：¥{totalInvAllocated.toFixed(2)}
                          </span>
                        </div>
                        <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                          {availableInvoices.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-2">
                              暂无可用发票
                            </div>
                          ) : (
                            availableInvoices.map((inv) => {
                              const detail = config.invoiceDetails.find(d => d.invoiceId === inv.id);
                              const isSelected = config.invoiceIds.includes(inv.id);
                              return (
                                <div key={inv.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${payable.id}-inv-${inv.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      toggleInvoice(payable.id, inv.id, !!checked, payable)
                                    }
                                  />
                                  <label
                                    htmlFor={`${payable.id}-inv-${inv.id}`}
                                    className="text-sm cursor-pointer flex-1 min-w-0"
                                  >
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
                                      onChange={(e) => updateInvoiceDetailAmount(
                                        payable.id, inv.id, Number(e.target.value), payable
                                      )}
                                      onClick={(e) => e.stopPropagation()}
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
                          <span className="font-medium">¥{totalPoAllocated.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>发票分配合计：</span>
                          <span className="font-medium">¥{totalInvAllocated.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
                          <span className="font-medium">本次核销金额：</span>
                          <span className="font-bold text-lg">¥{maxAmount.toFixed(2)}</span>
                        </div>
                        {totalPoAllocated !== totalInvAllocated && totalPoAllocated > 0 && totalInvAllocated > 0 && (
                          <div className="text-xs text-amber-600">
                            提示：付款单与发票的分配金额不相等，将取较小值作为核销金额
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            已配置 {validCount} / {payablesWithDetails.length} 个应付单
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || validCount === 0}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              确认批量核销
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
