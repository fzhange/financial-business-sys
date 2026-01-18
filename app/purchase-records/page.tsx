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
import { Plus, Trash2 } from 'lucide-react';
import type { PurchaseRecord, PurchaseRecordItem, Supplier } from '@/lib/db';

export default function PurchaseRecordsPage() {
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');

  // 表单状态
  const [formData, setFormData] = useState({
    type: 'inbound' as 'inbound' | 'return',
    supplierId: '',
    supplierName: '',
    poNo: '',
    recordDate: new Date().toISOString().split('T')[0],
    items: [] as PurchaseRecordItem[],
  });

  useEffect(() => {
    fetchRecords();
    fetchSuppliers();
  }, []);

  const fetchRecords = async () => {
    const res = await fetch('/api/purchase-records');
    const data = await res.json();
    setRecords(data);
  };

  const fetchSuppliers = async () => {
    const res = await fetch('/api/suppliers');
    const data = await res.json();
    setSuppliers(data);
  };

  const handleSubmit = async () => {
    if (!formData.supplierId || !formData.poNo || formData.items.length === 0) {
      alert('请填写完整信息');
      return;
    }

    const res = await fetch('/api/purchase-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      setDialogOpen(false);
      fetchRecords();
      resetForm();
    }
  };

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/purchase-records/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    if (res.ok) {
      fetchRecords();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该记录？')) return;

    const res = await fetch(`/api/purchase-records/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchRecords();
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'inbound',
      supplierId: '',
      supplierName: '',
      poNo: '',
      recordDate: new Date().toISOString().split('T')[0],
      items: [],
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          id: Date.now().toString(),
          productCode: '',
          productName: '',
          specification: '',
          unit: '个',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
        },
      ],
    });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      item.amount = Number(item.quantity) * Number(item.unitPrice);
    }
    newItems[index] = item;
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const filteredRecords = records.filter((r) => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterSupplierId !== 'all' && r.supplierId !== filterSupplierId) return false;
    if (filterDateStart && r.recordDate < filterDateStart) return false;
    if (filterDateEnd && r.recordDate > filterDateEnd) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">采购记录</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              新增记录
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增采购记录</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>类型</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as 'inbound' | 'return' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">入库</SelectItem>
                      <SelectItem value="return">退货</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>供应商</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(v) => {
                      const supplier = suppliers.find((s) => s.id === v);
                      setFormData({
                        ...formData,
                        supplierId: v,
                        supplierName: supplier?.name || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择供应商" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>采购订单号</Label>
                  <Input
                    value={formData.poNo}
                    onChange={(e) => setFormData({ ...formData, poNo: e.target.value })}
                    placeholder="PO-XXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>单据日期</Label>
                  <Input
                    type="date"
                    value={formData.recordDate}
                    onChange={(e) => setFormData({ ...formData, recordDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>明细</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    添加明细
                  </Button>
                </div>
                {formData.items.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>物料编码</TableHead>
                        <TableHead>物料名称</TableHead>
                        <TableHead>规格</TableHead>
                        <TableHead>单位</TableHead>
                        <TableHead>数量</TableHead>
                        <TableHead>单价</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Input
                              value={item.productCode}
                              onChange={(e) => updateItem(index, 'productCode', e.target.value)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.productName}
                              onChange={(e) => updateItem(index, 'productName', e.target.value)}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.specification}
                              onChange={(e) => updateItem(index, 'specification', e.target.value)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.unit}
                              onChange={(e) => updateItem(index, 'unit', e.target.value)}
                              className="w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell className="text-right">¥{item.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-lg font-semibold">
                  合计：¥{formData.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                </div>
                <Button onClick={handleSubmit}>保存</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="inbound">入库</SelectItem>
                <SelectItem value="return">退货</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSupplierId} onValueChange={setFilterSupplierId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="供应商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部供应商</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待确认</SelectItem>
                <SelectItem value="confirmed">已确认</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="w-36"
                placeholder="开始日期"
              />
              <span className="text-muted-foreground">至</span>
              <Input
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                className="w-36"
                placeholder="结束日期"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>单据编号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>采购订单号</TableHead>
                <TableHead>单据日期</TableHead>
                <TableHead className="text-right">总金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.recordNo}</TableCell>
                  <TableCell>
                    <Badge variant={record.type === 'inbound' ? 'default' : 'secondary'}>
                      {record.type === 'inbound' ? '入库' : '退货'}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.supplierName}</TableCell>
                  <TableCell>{record.poNo}</TableCell>
                  <TableCell>{record.recordDate}</TableCell>
                  <TableCell className="text-right">¥{record.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === 'confirmed' ? 'default' : 'outline'}>
                      {record.status === 'pending' ? '待确认' : '已确认'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {record.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfirm(record.id)}
                          >
                            确认
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRecords.length === 0 && (
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
    </div>
  );
}
