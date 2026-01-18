'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Check, Eye, AlertTriangle, Edit, Send, Building2, Truck, Trash2 } from 'lucide-react';
import type { SupplierStatement, PurchaseRecord, Supplier } from '@/lib/db';

// 供应商对账明细项
interface SupplierStatementItem {
  id: string;
  itemNo: string;       // 单据号
  itemDate: string;     // 日期
  type: 'sale' | 'return'; // 销售/退货
  description: string;  // 描述
  amount: number;       // 金额
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: '草稿', variant: 'outline' },
  pending_supplier_confirm: { label: '待供应商确认', variant: 'secondary' },
  disputed: { label: '有争议', variant: 'destructive' },
  pending_buyer_confirm: { label: '待采购方确认', variant: 'secondary' },
  confirmed: { label: '已确认', variant: 'default' },
};

export default function SupplierStatementsPage() {
  const [statements, setStatements] = useState<SupplierStatement[]>([]);
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [supplierConfirmDialogOpen, setSupplierConfirmDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<SupplierStatement | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [supplierInputAmount, setSupplierInputAmount] = useState(0);
  const [disputeReason, setDisputeReason] = useState('');
  
  // 供应商对账明细
  const [supplierItems, setSupplierItems] = useState<SupplierStatementItem[]>([]);
  const [newSupplierItem, setNewSupplierItem] = useState<Partial<SupplierStatementItem>>({
    itemNo: '',
    itemDate: '',
    type: 'sale',
    description: '',
    amount: 0,
  });

  const [formData, setFormData] = useState({
    supplierId: '',
    supplierName: '',
    periodStart: '',
    periodEnd: '',
    remarks: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [statementsRes, recordsRes, suppliersRes] = await Promise.all([
      fetch('/api/supplier-statements'),
      fetch('/api/purchase-records?status=confirmed'),
      fetch('/api/suppliers'),
    ]);
    setStatements(await statementsRes.json());
    setPurchaseRecords(await recordsRes.json());
    setSuppliers(await suppliersRes.json());
  };

  // 采购方生成对账单
  const handleSubmit = async () => {
    if (!formData.supplierId || selectedRecords.length === 0) {
      alert('请选择供应商和采购记录');
      return;
    }

    const res = await fetch('/api/supplier-statements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        purchaseRecordIds: selectedRecords,
        supplierAmount: 0,
        supplierItems: [],
      }),
    });

    if (res.ok) {
      setDialogOpen(false);
      fetchData();
      resetForm();
    }
  };

  // 发送给供应商确认
  const handleSendToSupplier = async (id: string) => {
    const res = await fetch(`/api/supplier-statements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending_supplier_confirm' }),
    });

    if (res.ok) {
      fetchData();
    }
  };

  // 供应商确认（录入供应商明细和金额）
  const handleSupplierConfirm = async () => {
    if (!selectedStatement) return;
    
    // 计算供应商总金额
    const totalAmount = supplierItems.reduce((sum, item) => {
      return sum + (item.type === 'sale' ? item.amount : -item.amount);
    }, 0);
    
    const res = await fetch(`/api/supplier-statements/${selectedStatement.id}/supplier-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        supplierAmount: totalAmount,
        supplierItems: supplierItems,
      }),
    });

    if (res.ok) {
      setSupplierConfirmDialogOpen(false);
      setSupplierInputAmount(0);
      setSupplierItems([]);
      fetchData();
    }
  };

  // 添加供应商明细项
  const addSupplierItem = () => {
    if (!newSupplierItem.itemNo || !newSupplierItem.amount) {
      alert('请填写单据号和金额');
      return;
    }
    const item: SupplierStatementItem = {
      id: `si-${Date.now()}`,
      itemNo: newSupplierItem.itemNo || '',
      itemDate: newSupplierItem.itemDate || new Date().toISOString().split('T')[0],
      type: newSupplierItem.type as 'sale' | 'return',
      description: newSupplierItem.description || '',
      amount: newSupplierItem.amount || 0,
    };
    setSupplierItems([...supplierItems, item]);
    setNewSupplierItem({
      itemNo: '',
      itemDate: '',
      type: 'sale',
      description: '',
      amount: 0,
    });
  };

  // 删除供应商明细项
  const removeSupplierItem = (id: string) => {
    setSupplierItems(supplierItems.filter(item => item.id !== id));
  };

  // 标记争议
  const handleDispute = async () => {
    if (!selectedStatement || !disputeReason.trim()) return;
    
    const res = await fetch(`/api/supplier-statements/${selectedStatement.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'disputed',
        disputeReason: disputeReason,
      }),
    });

    if (res.ok) {
      setDisputeDialogOpen(false);
      setDetailDialogOpen(false);
      setDisputeReason('');
      fetchData();
    }
  };

  // 采购方修改对账单（选择采购记录）
  const handleEditSubmit = async () => {
    if (!selectedStatement || selectedRecords.length === 0) return;

    const res = await fetch(`/api/supplier-statements/${selectedStatement.id}/edit-records`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        purchaseRecordIds: selectedRecords,
      }),
    });

    if (res.ok) {
      setEditDialogOpen(false);
      fetchData();
    }
  };

  // 采购方确认
  const handleBuyerConfirm = async (id: string) => {
    const statement = statements.find(s => s.id === id);
    if (!statement) return;

    const diff = (statement.supplierAmount ?? 0) - (statement.netAmount ?? 0);
    if (Math.abs(diff) > 0.01) {
      alert('对账差异不为零，请先解决差异后再确认');
      return;
    }

    const res = await fetch(`/api/supplier-statements/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmType: 'buyer', confirmedBy: '当前用户' }),
    });

    if (res.ok) {
      fetchData();
      setDetailDialogOpen(false);
    }
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      supplierName: '',
      periodStart: '',
      periodEnd: '',
      remarks: '',
    });
    setSelectedRecords([]);
  };

  const filteredRecords = purchaseRecords.filter(
    r => r.supplierId === (formData.supplierId || selectedStatement?.supplierId)
  );

  const calculateTotal = (records: PurchaseRecord[], selectedIds: string[]) => {
    return records
      .filter(r => selectedIds.includes(r.id))
      .reduce((sum, r) => sum + (r.type === 'inbound' ? r.totalAmount : -r.totalAmount), 0);
  };

  const selectedTotal = calculateTotal(filteredRecords, selectedRecords);

  // 计算供应商明细总额
  const supplierItemsTotal = supplierItems.reduce((sum, item) => {
    return sum + (item.type === 'sale' ? item.amount : -item.amount);
  }, 0);

  const openEditDialog = (statement: SupplierStatement) => {
    setSelectedStatement(statement);
    setSelectedRecords(statement.purchaseRecordIds || []);
    setEditDialogOpen(true);
  };

  // 获取采购方明细（基于对账单关联的采购记录）
  const getBuyerItems = (statement: SupplierStatement) => {
    return purchaseRecords.filter(r => statement.purchaseRecordIds?.includes(r.id));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">供应商对账单</h1>
          <p className="text-sm text-muted-foreground mt-1">
            流程：采购方生成 → 发送供应商 → 供应商提供对账单 → 双方核对差异 → 确认
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              新增对账单
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>采购方生成对账单</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>供应商</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(v) => {
                      const supplier = suppliers.find(s => s.id === v);
                      setFormData({
                        ...formData,
                        supplierId: v,
                        supplierName: supplier?.name || '',
                      });
                      setSelectedRecords([]);
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
                <div />
                <div className="space-y-2">
                  <Label>账期开始</Label>
                  <Input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>账期结束</Label>
                  <Input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  />
                </div>
              </div>

              {formData.supplierId && (
                <div className="space-y-2">
                  <Label>选择账期内的采购/退货记录</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">选择</TableHead>
                        <TableHead>单据编号</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>单据日期</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map(record => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedRecords.includes(record.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecords([...selectedRecords, record.id]);
                                } else {
                                  setSelectedRecords(selectedRecords.filter(id => id !== record.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>{record.recordNo}</TableCell>
                          <TableCell>
                            <Badge variant={record.type === 'inbound' ? 'default' : 'secondary'}>
                              {record.type === 'inbound' ? '入库' : '退货'}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.recordDate}</TableCell>
                          <TableCell className="text-right">
                            {record.type === 'return' && '-'}¥{record.totalAmount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            该供应商暂无已确认的采购记录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-lg font-medium">
                  采购方合计净额：<span className="text-blue-600">¥{selectedTotal.toFixed(2)}</span>
                </div>
                <Button onClick={handleSubmit}>保存草稿</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>对账单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>账期</TableHead>
                <TableHead className="text-right">采购方净额</TableHead>
                <TableHead className="text-right">供应商金额</TableHead>
                <TableHead className="text-right">差异</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.map(statement => {
                const diff = (statement.supplierAmount ?? 0) - (statement.netAmount ?? 0);
                const hasDiff = Math.abs(diff) > 0.01;
                return (
                  <TableRow key={statement.id}>
                    <TableCell className="font-medium">{statement.statementNo}</TableCell>
                    <TableCell>{statement.supplierName}</TableCell>
                    <TableCell>{statement.periodStart} ~ {statement.periodEnd}</TableCell>
                    <TableCell className="text-right">¥{(statement.netAmount ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {statement.supplierAmount ? `¥${statement.supplierAmount.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className={`text-right ${hasDiff ? 'text-red-500 font-medium' : 'text-green-600'}`}>
                      {statement.supplierAmount ? `¥${diff.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusMap[statement.status]?.variant || 'outline'}>
                        {statusMap[statement.status]?.label || statement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStatement(statement);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {statement.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendToSupplier(statement.id)}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            发送
                          </Button>
                        )}
                        
                        {statement.status === 'pending_supplier_confirm' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedStatement(statement);
                              setSupplierItems((statement as any).supplierItems || []);
                              setSupplierConfirmDialogOpen(true);
                            }}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            供应商确认
                          </Button>
                        )}
                        
                        {statement.status === 'disputed' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedStatement(statement);
                                setSupplierItems((statement as any).supplierItems || []);
                                setSupplierConfirmDialogOpen(true);
                              }}
                            >
                              <Truck className="w-4 h-4 mr-1" />
                              供应商修正
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(statement)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              采购方修正
                            </Button>
                          </>
                        )}
                        
                        {statement.status === 'pending_buyer_confirm' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleBuyerConfirm(statement.id)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            采购方确认
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {statements.length === 0 && (
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

      {/* 详情弹窗 - 带有双方明细对比 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>对账单详情 - {selectedStatement?.statementNo}</DialogTitle>
          </DialogHeader>
          {selectedStatement && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">供应商：</span>{selectedStatement.supplierName}</div>
                <div><span className="text-muted-foreground">账期：</span>{selectedStatement.periodStart} ~ {selectedStatement.periodEnd}</div>
                <div>
                  <span className="text-muted-foreground">状态：</span>
                  <Badge variant={statusMap[selectedStatement.status]?.variant || 'outline'} className="ml-2">
                    {statusMap[selectedStatement.status]?.label}
                  </Badge>
                </div>
              </div>
              
              {/* 对账核对汇总 */}
              <div className="border rounded-lg p-4 bg-slate-50">
                <h4 className="font-medium mb-3">对账核对汇总</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-xs text-blue-600 mb-1 flex items-center justify-center gap-1">
                      <Building2 className="w-3 h-3" />
                      采购方净额
                    </div>
                    <div className="text-xl font-bold text-blue-600">¥{(selectedStatement.netAmount ?? 0).toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded border border-purple-200">
                    <div className="text-xs text-purple-600 mb-1 flex items-center justify-center gap-1">
                      <Truck className="w-3 h-3" />
                      供应商金额
                    </div>
                    <div className="text-xl font-bold text-purple-600">
                      {selectedStatement.supplierAmount ? `¥${selectedStatement.supplierAmount.toFixed(2)}` : '待提供'}
                    </div>
                  </div>
                  <div className={`p-3 rounded border ${
                    !selectedStatement.supplierAmount ? 'bg-gray-50 border-gray-200' :
                    Math.abs((selectedStatement.supplierAmount ?? 0) - (selectedStatement.netAmount ?? 0)) > 0.01 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className={`text-xs mb-1 ${
                      !selectedStatement.supplierAmount ? 'text-gray-500' :
                      Math.abs((selectedStatement.supplierAmount ?? 0) - (selectedStatement.netAmount ?? 0)) > 0.01 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>差异金额</div>
                    <div className={`text-xl font-bold ${
                      !selectedStatement.supplierAmount ? 'text-gray-400' :
                      Math.abs((selectedStatement.supplierAmount ?? 0) - (selectedStatement.netAmount ?? 0)) > 0.01 
                        ? 'text-red-500' 
                        : 'text-green-600'
                    }`}>
                      {selectedStatement.supplierAmount 
                        ? `¥${((selectedStatement.supplierAmount ?? 0) - (selectedStatement.netAmount ?? 0)).toFixed(2)}` 
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 双方明细对比 */}
              <Tabs defaultValue="buyer" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="buyer" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    采购方对账单
                  </TabsTrigger>
                  <TabsTrigger value="supplier" className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    供应商对账单
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="buyer" className="mt-4">
                  <div className="border rounded-lg">
                    <div className="bg-blue-50 px-4 py-2 border-b flex justify-between items-center">
                      <span className="font-medium text-blue-700">采购方收货/退货记录</span>
                      <span className="text-sm text-blue-600">
                        入库：¥{(selectedStatement.totalPurchaseAmount ?? 0).toFixed(2)} | 
                        退货：¥{(selectedStatement.totalReturnAmount ?? 0).toFixed(2)} | 
                        净额：<span className="font-bold">¥{(selectedStatement.netAmount ?? 0).toFixed(2)}</span>
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>单据编号</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>单据日期</TableHead>
                          <TableHead>采购单号</TableHead>
                          <TableHead className="text-right">金额</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getBuyerItems(selectedStatement).map(record => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.recordNo}</TableCell>
                            <TableCell>
                              <Badge variant={record.type === 'inbound' ? 'default' : 'secondary'}>
                                {record.type === 'inbound' ? '入库' : '退货'}
                              </Badge>
                            </TableCell>
                            <TableCell>{record.recordDate}</TableCell>
                            <TableCell>{record.poNo}</TableCell>
                            <TableCell className={`text-right font-medium ${record.type === 'return' ? 'text-red-500' : ''}`}>
                              {record.type === 'return' && '-'}¥{record.totalAmount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {getBuyerItems(selectedStatement).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                              暂无采购记录
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                <TabsContent value="supplier" className="mt-4">
                  <div className="border rounded-lg">
                    <div className="bg-purple-50 px-4 py-2 border-b flex justify-between items-center">
                      <span className="font-medium text-purple-700">供应商销售/退货记录</span>
                      <span className="text-sm text-purple-600">
                        净额：<span className="font-bold">
                          {selectedStatement.supplierAmount ? `¥${selectedStatement.supplierAmount.toFixed(2)}` : '待提供'}
                        </span>
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>单据编号</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead>描述</TableHead>
                          <TableHead className="text-right">金额</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {((selectedStatement as any).supplierItems || []).map((item: SupplierStatementItem) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.itemNo}</TableCell>
                            <TableCell>
                              <Badge variant={item.type === 'sale' ? 'default' : 'secondary'}>
                                {item.type === 'sale' ? '销售' : '退货'}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.itemDate}</TableCell>
                            <TableCell>{item.description || '-'}</TableCell>
                            <TableCell className={`text-right font-medium ${item.type === 'return' ? 'text-red-500' : ''}`}>
                              {item.type === 'return' && '-'}¥{item.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!((selectedStatement as any).supplierItems) || (selectedStatement as any).supplierItems.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                              {selectedStatement.status === 'draft' || selectedStatement.status === 'pending_supplier_confirm' 
                                ? '等待供应商提供对账明细' 
                                : '供应商未提供明细'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 争议信息 */}
              {selectedStatement.status === 'disputed' && selectedStatement.disputeReason && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-center gap-2 text-red-600 font-medium mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    争议原因
                  </div>
                  <p className="text-sm">{selectedStatement.disputeReason}</p>
                </div>
              )}

              {/* 确认记录 */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">确认记录</h4>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    {selectedStatement.supplierConfirmed ? (
                      <Badge variant="default" className="text-xs">已确认</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">未确认</Badge>
                    )}
                    <span>供应商确认</span>
                    {selectedStatement.supplierConfirmedAt && (
                      <span className="text-muted-foreground">({selectedStatement.supplierConfirmedAt})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedStatement.buyerConfirmed ? (
                      <Badge variant="default" className="text-xs">已确认</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">未确认</Badge>
                    )}
                    <span>采购方确认</span>
                    {selectedStatement.buyerConfirmedAt && (
                      <span className="text-muted-foreground">
                        ({selectedStatement.buyerConfirmedAt} by {selectedStatement.buyerConfirmedBy})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              {selectedStatement.status === 'pending_buyer_confirm' && (
                <div className="flex gap-2 pt-4 border-t">
                  {Math.abs((selectedStatement.supplierAmount ?? 0) - (selectedStatement.netAmount ?? 0)) > 0.01 ? (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setDisputeDialogOpen(true)}
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        标记争议
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => openEditDialog(selectedStatement)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        修改记录
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="flex-1"
                      onClick={() => handleBuyerConfirm(selectedStatement.id)}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      确认对账单
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 供应商确认弹窗 - 录入明细 */}
      <Dialog open={supplierConfirmDialogOpen} onOpenChange={setSupplierConfirmDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>供应商提供对账单</DialogTitle>
          </DialogHeader>
          {selectedStatement && (
            <div className="space-y-4">
              <div className="text-sm bg-blue-50 p-3 rounded-lg">
                <span className="text-muted-foreground">采购方对账净额：</span>
                <span className="font-bold text-blue-600">¥{(selectedStatement.netAmount ?? 0).toFixed(2)}</span>
              </div>
              
              {/* 供应商明细录入表格 */}
              <div className="space-y-2">
                <Label>供应商销售/退货明细</Label>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>单据号</TableHead>
                        <TableHead>日期</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{item.itemNo}</TableCell>
                          <TableCell>{item.itemDate}</TableCell>
                          <TableCell>
                            <Badge variant={item.type === 'sale' ? 'default' : 'secondary'}>
                              {item.type === 'sale' ? '销售' : '退货'}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.description || '-'}</TableCell>
                          <TableCell className={`text-right ${item.type === 'return' ? 'text-red-500' : ''}`}>
                            {item.type === 'return' && '-'}¥{item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSupplierItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* 新增行 */}
                      <TableRow className="bg-slate-50">
                        <TableCell>
                          <Input
                            placeholder="单据号"
                            value={newSupplierItem.itemNo}
                            onChange={(e) => setNewSupplierItem({ ...newSupplierItem, itemNo: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={newSupplierItem.itemDate}
                            onChange={(e) => setNewSupplierItem({ ...newSupplierItem, itemDate: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={newSupplierItem.type}
                            onValueChange={(v) => setNewSupplierItem({ ...newSupplierItem, type: v as 'sale' | 'return' })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sale">销售</SelectItem>
                              <SelectItem value="return">退货</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="描述"
                            value={newSupplierItem.description}
                            onChange={(e) => setNewSupplierItem({ ...newSupplierItem, description: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="金额"
                            value={newSupplierItem.amount || ''}
                            onChange={(e) => setNewSupplierItem({ ...newSupplierItem, amount: Number(e.target.value) })}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={addSupplierItem} className="h-8">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 汇总和差异 */}
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">采购方净额</div>
                    <div className="text-lg font-bold text-blue-600">¥{(selectedStatement.netAmount ?? 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">供应商净额</div>
                    <div className="text-lg font-bold text-purple-600">¥{supplierItemsTotal.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">差异</div>
                    <div className={`text-lg font-bold ${
                      Math.abs(supplierItemsTotal - (selectedStatement.netAmount ?? 0)) > 0.01 
                        ? 'text-red-500' 
                        : 'text-green-600'
                    }`}>
                      ¥{(supplierItemsTotal - (selectedStatement.netAmount ?? 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSupplierConfirmDialogOpen(false);
              setSupplierItems([]);
            }}>取消</Button>
            <Button onClick={handleSupplierConfirm} disabled={supplierItems.length === 0}>
              确认提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标记争议弹窗 */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记对账争议</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>争议原因</Label>
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="请描述差异原因，如：供应商数据错误、采购方收货记录缺失等"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDispute}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              标记争议
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑采购记录弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>修改对账单采购记录</DialogTitle>
          </DialogHeader>
          {selectedStatement && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                供应商：{selectedStatement.supplierName} | 
                供应商金额：¥{(selectedStatement.supplierAmount ?? 0).toFixed(2)}
              </div>
              
              <div className="space-y-2">
                <Label>选择采购记录</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">选择</TableHead>
                      <TableHead>单据编号</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>单据日期</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseRecords
                      .filter(r => r.supplierId === selectedStatement.supplierId)
                      .map(record => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedRecords.includes(record.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecords([...selectedRecords, record.id]);
                                } else {
                                  setSelectedRecords(selectedRecords.filter(id => id !== record.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>{record.recordNo}</TableCell>
                          <TableCell>
                            <Badge variant={record.type === 'inbound' ? 'default' : 'secondary'}>
                              {record.type === 'inbound' ? '入库' : '退货'}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.recordDate}</TableCell>
                          <TableCell className="text-right">
                            {record.type === 'return' && '-'}¥{record.totalAmount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="space-y-1">
                  <div>新采购方合计：¥{calculateTotal(
                    purchaseRecords.filter(r => r.supplierId === selectedStatement.supplierId),
                    selectedRecords
                  ).toFixed(2)}</div>
                  <div className={Math.abs(calculateTotal(
                    purchaseRecords.filter(r => r.supplierId === selectedStatement.supplierId),
                    selectedRecords
                  ) - (selectedStatement.supplierAmount ?? 0)) > 0.01 ? 'text-red-500' : 'text-green-500'}>
                    差异：¥{((selectedStatement.supplierAmount ?? 0) - calculateTotal(
                      purchaseRecords.filter(r => r.supplierId === selectedStatement.supplierId),
                      selectedRecords
                    )).toFixed(2)}
                  </div>
                </div>
                <Button onClick={handleEditSubmit}>保存修改</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
