'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle, Trash2, Upload, FileText, ScanLine, XCircle, Filter } from 'lucide-react';
import type { Invoice, Supplier, AccountsPayable } from '@/lib/db';

interface InvoiceWithVerificationType extends Invoice {
  lastVerificationType?: 'auto' | 'manual' | null;
}

const invoiceTypeMap: Record<string, string> = {
  vat_special: '增值税专用发票',
  vat_normal: '增值税普通发票',
  other: '其他',
};

const inputMethodMap: Record<string, string> = {
  manual: '手工录入',
  ocr: 'OCR识别',
  electronic_import: '电子发票导入',
};

const authenticityStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: '待验证', variant: 'outline' },
  verified: { label: '已验真', variant: 'default' },
  failed: { label: '验证失败', variant: 'destructive' },
};

interface PayableAllocation {
  payableId: string;
  amount: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithVerificationType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  
  // 弹窗状态
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [businessVerifyDialogOpen, setBusinessVerifyDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // 筛选状态
  const [filters, setFilters] = useState({
    supplierId: '',
    usable: '',
    authenticityStatus: '',
    verificationStatus: '',
    inputMethod: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // 手工录入表单
  const [formData, setFormData] = useState({
    invoiceCode: '',
    invoiceNo: '',
    invoiceType: 'vat_special' as 'vat_special' | 'vat_normal' | 'other',
    supplierId: '',
    supplierName: '',
    sellerName: '',
    sellerTaxNo: '',
    amount: 0,
    taxAmount: 0,
    invoiceDate: '',
    remarks: '',
  });

  // 多选应付账款及金额分摊
  const [selectedPayables, setSelectedPayables] = useState<PayableAllocation[]>([]);

  // OCR识别状态
  const [ocrState, setOcrState] = useState<'idle' | 'uploading' | 'recognizing' | 'success' | 'failed'>('idle');
  const [ocrResult, setOcrResult] = useState<Partial<typeof formData> | null>(null);

  // 电子发票导入状态
  const [importState, setImportState] = useState<'idle' | 'importing' | 'done'>('idle');
  const [importResult, setImportResult] = useState<{ success: number; failed: number; duplicate: number; errors: string[] } | null>(null);

  // 业务校验表单
  const [businessVerifyForm, setBusinessVerifyForm] = useState({
    usable: true,
    unusableReason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [invoicesRes, suppliersRes, payablesRes] = await Promise.all([
      fetch('/api/invoices'),
      fetch('/api/suppliers'),
      fetch('/api/accounts-payable'),
    ]);
    setInvoices(await invoicesRes.json());
    setSuppliers(await suppliersRes.json());
    setPayables(await payablesRes.json());
  };

  // 筛选后的发票列表
  const filteredInvoices = invoices.filter(inv => {
    if (filters.supplierId && inv.supplierId !== filters.supplierId) return false;
    if (filters.usable === 'true' && !inv.usable) return false;
    if (filters.usable === 'false' && inv.usable) return false;
    if (filters.authenticityStatus && inv.authenticityStatus !== filters.authenticityStatus) return false;
    if (filters.verificationStatus && inv.verificationStatus !== filters.verificationStatus) return false;
    if (filters.inputMethod && inv.inputMethod !== filters.inputMethod) return false;
    if (filters.dateFrom && inv.invoiceDate < filters.dateFrom) return false;
    if (filters.dateTo && inv.invoiceDate > filters.dateTo) return false;
    return true;
  });

  // 根据选中供应商筛选应付账款
  const filteredPayables = payables.filter(p => p.supplierId === formData.supplierId);

  // 切换应付账款选择
  const togglePayable = (payableId: string, checked: boolean) => {
    if (checked) {
      const payable = payables.find(p => p.id === payableId);
      // 计算剩余可开票金额
      const remainingInvoicable = payable ? payable.payableAmount - payable.invoicedAmount : 0;
      const totalAmount = formData.amount + formData.taxAmount;
      // 已分配的金额
      const allocatedTotal = selectedPayables.reduce((sum, p) => sum + p.amount, 0);
      // 本次默认分配金额 = min(剩余可开票, 发票金额 - 已分配)
      const defaultAmount = Math.min(remainingInvoicable, totalAmount - allocatedTotal);
      setSelectedPayables([...selectedPayables, { payableId, amount: Math.max(0, defaultAmount) }]);
    } else {
      setSelectedPayables(selectedPayables.filter(p => p.payableId !== payableId));
    }
  };

  // 更新分摊金额
  const updateAllocation = (payableId: string, amount: number) => {
    const payable = payables.find(p => p.id === payableId);
    const maxAmount = payable ? payable.payableAmount - payable.invoicedAmount : 0;
    const validAmount = Math.max(0, Math.min(amount, maxAmount));
    setSelectedPayables(selectedPayables.map(p => 
      p.payableId === payableId ? { ...p, amount: validAmount } : p
    ));
  };

  // 手工录入提交
  const handleManualSubmit = async () => {
    if (!formData.invoiceCode || !formData.invoiceNo || !formData.supplierId) {
      alert('请填写必填信息（发票代码、发票号码、供应商）');
      return;
    }

    const totalAmount = formData.amount + formData.taxAmount;
    const allocatedTotal = selectedPayables.reduce((sum, p) => sum + p.amount, 0);
    
    if (selectedPayables.length > 0 && allocatedTotal > totalAmount) {
      alert('分摊金额总和不能超过发票价税合计');
      return;
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        totalAmount,
        inputMethod: 'manual',
        payableAllocations: selectedPayables.filter(p => p.amount > 0),
      }),
    });

    if (res.ok) {
      setManualDialogOpen(false);
      fetchData();
      resetForm();
    } else {
      const error = await res.json();
      alert(error.error);
    }
  };

  // OCR识别模拟
  const handleOcrUpload = async () => {
    setOcrState('uploading');
    
    // 模拟上传和识别过程
    await new Promise(resolve => setTimeout(resolve, 1000));
    setOcrState('recognizing');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 模拟识别结果（80%成功率）
    if (Math.random() > 0.2) {
      setOcrState('success');
      setOcrResult({
        invoiceCode: '3100' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0'),
        invoiceNo: Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
        invoiceType: 'vat_special',
        amount: Math.floor(Math.random() * 10000) + 1000,
        taxAmount: Math.floor(Math.random() * 1000) + 100,
        invoiceDate: new Date().toISOString().split('T')[0],
        sellerName: '模拟识别公司名称',
        sellerTaxNo: '91310000' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
      });
    } else {
      setOcrState('failed');
    }
  };

  // OCR识别结果确认
  const handleOcrConfirm = async () => {
    if (!ocrResult || !formData.supplierId) {
      alert('请选择供应商');
      return;
    }

    const totalAmount = (ocrResult.amount || 0) + (ocrResult.taxAmount || 0);
    
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...ocrResult,
        supplierId: formData.supplierId,
        supplierName: suppliers.find(s => s.id === formData.supplierId)?.name || '',
        totalAmount,
        inputMethod: 'ocr',
        payableAllocations: selectedPayables.filter(p => p.amount > 0),
      }),
    });

    if (res.ok) {
      setOcrDialogOpen(false);
      setOcrState('idle');
      setOcrResult(null);
      fetchData();
      resetForm();
    } else {
      const error = await res.json();
      alert(error.error);
    }
  };

  // 电子发票导入模拟
  const handleImport = async () => {
    setImportState('importing');
    
    // 模拟导入过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 模拟导入结果
    const success = Math.floor(Math.random() * 5) + 1;
    const duplicate = Math.floor(Math.random() * 2);
    const failed = Math.floor(Math.random() * 2);
    
    setImportResult({
      success,
      duplicate,
      failed,
      errors: failed > 0 ? ['文件格式损坏：invoice_003.pdf', '解析失败：invoice_005.xml'] : [],
    });
    setImportState('done');
    
    // 刷新数据（模拟导入了一些发票）
    fetchData();
  };

  // 真伪校验
  const handleAuthenticate = async (id: string) => {
    const res = await fetch(`/api/invoices/${id}/authenticate`, {
      method: 'POST',
    });

    if (res.ok) {
      const result = await res.json();
      alert(result.message);
      fetchData();
    }
  };

  // 业务校验
  const handleBusinessVerify = async () => {
    if (!selectedInvoice) return;
    
    if (!businessVerifyForm.usable && businessVerifyForm.unusableReason.length < 5) {
      alert('请填写不可用原因（至少5个字符）');
      return;
    }

    const res = await fetch(`/api/invoices/${selectedInvoice.id}/business-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(businessVerifyForm),
    });

    if (res.ok) {
      setBusinessVerifyDialogOpen(false);
      setSelectedInvoice(null);
      fetchData();
    } else {
      const error = await res.json();
      alert(error.error);
    }
  };

  // 删除发票
  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该发票？')) return;

    const res = await fetch(`/api/invoices/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchData();
    } else {
      const error = await res.json();
      alert(error.error);
    }
  };

  const resetForm = () => {
    setFormData({
      invoiceCode: '',
      invoiceNo: '',
      invoiceType: 'vat_special',
      supplierId: '',
      supplierName: '',
      sellerName: '',
      sellerTaxNo: '',
      amount: 0,
      taxAmount: 0,
      invoiceDate: '',
      remarks: '',
    });
    setSelectedPayables([]);
  };

  const resetFilters = () => {
    setFilters({
      supplierId: '',
      usable: '',
      authenticityStatus: '',
      verificationStatus: '',
      inputMethod: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">发票管理</h1>
        <div className="flex gap-2">
          {/* OCR识别 */}
          <Dialog open={ocrDialogOpen} onOpenChange={(open) => {
            setOcrDialogOpen(open);
            if (!open) {
              setOcrState('idle');
              setOcrResult(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ScanLine className="w-4 h-4 mr-2" />
                OCR识别
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>OCR识别发票</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {ocrState === 'idle' && (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">上传发票图片（支持JPG、PNG格式）</p>
                    <Button onClick={handleOcrUpload}>选择图片</Button>
                  </div>
                )}
                
                {ocrState === 'uploading' && (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p>正在上传...</p>
                  </div>
                )}
                
                {ocrState === 'recognizing' && (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p>正在识别发票内容...</p>
                  </div>
                )}
                
                {ocrState === 'failed' && (
                  <div className="text-center py-8">
                    <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                    <p className="text-red-500 mb-4">识别失败，请检查图片质量或改用手工录入</p>
                    <Button onClick={() => setOcrState('idle')}>重新上传</Button>
                  </div>
                )}
                
                {ocrState === 'success' && ocrResult && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                      识别成功！请核对以下信息（注：OCR结果不可修改，如有错误请重新上传清晰图片）
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">发票代码：</span>{ocrResult.invoiceCode}</div>
                      <div><span className="text-muted-foreground">发票号码：</span>{ocrResult.invoiceNo}</div>
                      <div><span className="text-muted-foreground">金额：</span>¥{ocrResult.amount?.toFixed(2)}</div>
                      <div><span className="text-muted-foreground">税额：</span>¥{ocrResult.taxAmount?.toFixed(2)}</div>
                      <div><span className="text-muted-foreground">价税合计：</span>¥{((ocrResult.amount || 0) + (ocrResult.taxAmount || 0)).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">开票日期：</span>{ocrResult.invoiceDate}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">销售方：</span>{ocrResult.sellerName}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">税号：</span>{ocrResult.sellerTaxNo}</div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>选择供应商 *</Label>
                      <Select
                        value={formData.supplierId}
                        onValueChange={(v) => {
                          const supplier = suppliers.find(s => s.id === v);
                          setFormData({
                            ...formData,
                            supplierId: v,
                            supplierName: supplier?.name || '',
                          });
                          setSelectedPayables([]);
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

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setOcrState('idle')}>重新上传</Button>
                      <Button onClick={handleOcrConfirm}>确认创建</Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* 电子发票导入 */}
          <Dialog open={importDialogOpen} onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) {
              setImportState('idle');
              setImportResult(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                电子发票导入
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>电子发票导入</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {importState === 'idle' && (
                  <>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-2">支持 PDF、OFD、XML 格式</p>
                      <p className="text-muted-foreground text-sm mb-4">可选择多个文件或上传ZIP压缩包</p>
                      <Button onClick={handleImport}>选择文件</Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      提示：系统将自动解析电子发票内容并创建发票记录，重复发票将被跳过。
                    </div>
                  </>
                )}
                
                {importState === 'importing' && (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p>正在导入...</p>
                  </div>
                )}
                
                {importState === 'done' && importResult && (
                  <div className="space-y-4">
                    <div className="bg-muted rounded-lg p-4">
                      <h4 className="font-medium mb-2">导入结果</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>成功导入：</span>
                          <span className="text-green-600 font-medium">{importResult.success} 张</span>
                        </div>
                        <div className="flex justify-between">
                          <span>重复跳过：</span>
                          <span className="text-amber-600 font-medium">{importResult.duplicate} 张</span>
                        </div>
                        <div className="flex justify-between">
                          <span>导入失败：</span>
                          <span className="text-red-600 font-medium">{importResult.failed} 张</span>
                        </div>
                      </div>
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                        <p className="font-medium mb-1">失败原因：</p>
                        {importResult.errors.map((err, i) => (
                          <p key={i}>· {err}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button onClick={() => setImportDialogOpen(false)}>关闭</Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* 手工录入 */}
          <Dialog open={manualDialogOpen} onOpenChange={(open) => {
            setManualDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                手工录入
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>手工录入发票</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>发票代码 *</Label>
                    <Input
                      value={formData.invoiceCode}
                      onChange={(e) => setFormData({ ...formData, invoiceCode: e.target.value })}
                      placeholder="发票代码"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>发票号码 *</Label>
                    <Input
                      value={formData.invoiceNo}
                      onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                      placeholder="发票号码"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>发票类型</Label>
                    <Select
                      value={formData.invoiceType}
                      onValueChange={(v) => setFormData({ ...formData, invoiceType: v as typeof formData.invoiceType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vat_special">增值税专用发票</SelectItem>
                        <SelectItem value="vat_normal">增值税普通发票</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                          sellerName: supplier?.name || '',
                          sellerTaxNo: supplier?.taxNo || '',
                        });
                        setSelectedPayables([]);
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
                    <Label>金额（不含税）</Label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>税额</Label>
                    <Input
                      type="number"
                      value={formData.taxAmount}
                      onChange={(e) => setFormData({ ...formData, taxAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>价税合计</Label>
                    <Input
                      type="number"
                      value={formData.amount + formData.taxAmount}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>开票日期</Label>
                    <Input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>销售方名称</Label>
                    <Input
                      value={formData.sellerName}
                      onChange={(e) => setFormData({ ...formData, sellerName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>销售方税号</Label>
                    <Input
                      value={formData.sellerTaxNo}
                      onChange={(e) => setFormData({ ...formData, sellerTaxNo: e.target.value })}
                    />
                  </div>
                </div>

                {/* 关联应付账款（多选） */}
                {formData.supplierId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>关联应付账款（可多选）</Label>
                      <span className="text-xs text-muted-foreground">
                        已分摊：¥{selectedPayables.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} / 
                        发票金额：¥{(formData.amount + formData.taxAmount).toFixed(2)}
                      </span>
                    </div>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                      {filteredPayables.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-2">该供应商暂无应付账款</div>
                      ) : (
                        filteredPayables.map(p => {
                          const allocation = selectedPayables.find(sp => sp.payableId === p.id);
                          const isSelected = !!allocation;
                          const remainingInvoicable = p.payableAmount - p.invoicedAmount;
                          return (
                            <div key={p.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`payable-${p.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => togglePayable(p.id, !!checked)}
                              />
                              <label htmlFor={`payable-${p.id}`} className="text-sm cursor-pointer flex-1 min-w-0">
                                <span className="truncate">{p.payableNo}</span>
                                <span className="text-muted-foreground ml-1">
                                  (可开票 ¥{remainingInvoicable.toFixed(2)})
                                </span>
                              </label>
                              {isSelected && (
                                <Input
                                  type="number"
                                  className="w-28 h-7 text-sm"
                                  value={allocation.amount}
                                  onChange={(e) => updateAllocation(p.id, Number(e.target.value))}
                                  max={remainingInvoicable}
                                  min={0}
                                  placeholder="分摊金额"
                                />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="可选"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setManualDialogOpen(false)}>取消</Button>
                  <Button onClick={handleManualSubmit}>保存</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              筛选条件
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? '收起' : '展开'}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">供应商</Label>
                <Select value={filters.supplierId || 'all'} onValueChange={(v) => setFilters({ ...filters, supplierId: v === 'all' ? '' : v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">可用状态</Label>
                <Select value={filters.usable || 'all'} onValueChange={(v) => setFilters({ ...filters, usable: v === 'all' ? '' : v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="true">可用</SelectItem>
                    <SelectItem value="false">不可用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">真伪校验</Label>
                <Select value={filters.authenticityStatus || 'all'} onValueChange={(v) => setFilters({ ...filters, authenticityStatus: v === 'all' ? '' : v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="pending">待验证</SelectItem>
                    <SelectItem value="verified">已验真</SelectItem>
                    <SelectItem value="failed">验证失败</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">核销状态</Label>
                <Select value={filters.verificationStatus || 'all'} onValueChange={(v) => setFilters({ ...filters, verificationStatus: v === 'all' ? '' : v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="unverified">未核销</SelectItem>
                    <SelectItem value="partial_verified">部分核销</SelectItem>
                    <SelectItem value="verified">已核销</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">录入方式</Label>
                <Select value={filters.inputMethod || 'all'} onValueChange={(v) => setFilters({ ...filters, inputMethod: v === 'all' ? '' : v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="manual">手工录入</SelectItem>
                    <SelectItem value="ocr">OCR识别</SelectItem>
                    <SelectItem value="electronic_import">电子发票导入</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">开票日期从</Label>
                <Input
                  type="date"
                  className="h-8"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">开票日期至</Label>
                <Input
                  type="date"
                  className="h-8"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={resetFilters}>重置</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 发票列表 */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">发票列表</CardTitle>
            <span className="text-sm text-muted-foreground">共 {filteredInvoices.length} 条</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>发票号码</TableHead>
                <TableHead>发票代码</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead className="text-right">价税合计</TableHead>
                <TableHead>开票日期</TableHead>
                <TableHead>录入方式</TableHead>
                <TableHead>真伪校验</TableHead>
                <TableHead>可用</TableHead>
                <TableHead>核销状态</TableHead>
                <TableHead>核销类型</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNo}</TableCell>
                  <TableCell>{inv.invoiceCode}</TableCell>
                  <TableCell>{invoiceTypeMap[inv.invoiceType]}</TableCell>
                  <TableCell>{inv.supplierName}</TableCell>
                  <TableCell className="text-right">¥{inv.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>{inv.invoiceDate}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{inputMethodMap[inv.inputMethod]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={authenticityStatusMap[inv.authenticityStatus]?.variant || 'outline'}>
                      {authenticityStatusMap[inv.authenticityStatus]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inv.usable ? (
                      <Badge variant="default">可用</Badge>
                    ) : (
                      <Badge variant="destructive" title={inv.unusableReason}>不可用</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.verificationStatus === 'verified' ? 'default' :
                      inv.verificationStatus === 'partial_verified' ? 'secondary' : 'outline'}>
                      {inv.verificationStatus === 'verified' ? '已核销' :
                        inv.verificationStatus === 'partial_verified' ? '部分核销' : '未核销'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inv.lastVerificationType ? (
                      <Badge variant={inv.lastVerificationType === 'auto' ? 'secondary' : 'outline'} className="text-xs">
                        {inv.lastVerificationType === 'auto' ? '自动' : '手动'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {inv.authenticityStatus === 'pending' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAuthenticate(inv.id)}
                          title="点击调用税务局接口验证发票真伪"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          验真
                        </Button>
                      )}
                      {inv.authenticityStatus === 'verified' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setBusinessVerifyForm({ usable: inv.usable, unusableReason: inv.unusableReason || '' });
                            setBusinessVerifyDialogOpen(true);
                          }}
                          title="业务校验"
                        >
                          业务校验
                        </Button>
                      )}
                      {!inv.usable && inv.verifiedAmount === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(inv.id)}
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredInvoices.length === 0 && (
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

      {/* 业务校验弹窗 */}
      <Dialog open={businessVerifyDialogOpen} onOpenChange={setBusinessVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>业务校验 - {selectedInvoice?.invoiceNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              请核对发票内容是否与采购业务一致，确认发票的可用状态。
            </div>
            <div className="space-y-2">
              <Label>可用状态</Label>
              <Select
                value={businessVerifyForm.usable ? 'true' : 'false'}
                onValueChange={(v) => setBusinessVerifyForm({ ...businessVerifyForm, usable: v === 'true' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">可用</SelectItem>
                  <SelectItem value="false">不可用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!businessVerifyForm.usable && (
              <div className="space-y-2">
                <Label>不可用原因 *</Label>
                <Textarea
                  value={businessVerifyForm.unusableReason}
                  onChange={(e) => setBusinessVerifyForm({ ...businessVerifyForm, unusableReason: e.target.value })}
                  placeholder="请填写不可用原因（至少5个字符）"
                  rows={3}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBusinessVerifyDialogOpen(false)}>取消</Button>
              <Button onClick={handleBusinessVerify}>确认</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
