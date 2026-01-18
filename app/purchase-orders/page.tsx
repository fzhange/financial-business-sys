'use client';

import { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Plus, Filter, CreditCard, CheckCircle, Package } from 'lucide-react';
import { PurchaseOrder, Supplier } from '@/lib/db';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestData, setRequestData] = useState({
    amount: 0,
    reason: ''
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrderData, setNewOrderData] = useState({
    supplierId: '',
    supplierName: '',
    totalAmount: 0,
    type: 'standard' as 'standard' | 'prepaid',
    remarks: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/purchase-orders');
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const handleOpenRequestDialog = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setRequestData({
      amount: order.unpaidAmount,
      reason: `预付请款: ${order.orderNo}`
    });
    setRequestDialogOpen(true);
  };

  const handleRequestSubmit = async () => {
    if (!selectedOrder) return;
    
    if (requestData.amount <= 0) {
      alert('请输入有效的请款金额');
      return;
    }

    if (requestData.amount > selectedOrder.unpaidAmount) {
      alert(`请款金额不能超过未付金额: ¥${selectedOrder.unpaidAmount.toLocaleString()}`);
      return;
    }

    try {
      const res = await fetch('/api/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedOrder.supplierId,
          supplierName: selectedOrder.supplierName,
          purchaseOrderId: selectedOrder.id,
          requestAmount: requestData.amount,
          requestReason: requestData.reason,
          payableIds: [],
          invoiceIds: []
        }),
      });

      if (res.ok) {
        alert('请款申请已提交，请到“请款管理”中查看和审批');
        setRequestDialogOpen(false);
        fetchOrders();
      } else {
        const error = await res.json();
        alert(error.error || '提交请款失败');
      }
    } catch (error) {
      console.error('Submit request failed:', error);
      alert('网络错误，提交失败');
    }
  };

  const handleCreateSubmit = async () => {
    if (!newOrderData.supplierId || newOrderData.totalAmount <= 0) {
      alert('请填写完整信息');
      return;
    }

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrderData),
      });

      if (res.ok) {
        setCreateDialogOpen(false);
        fetchOrders();
        setNewOrderData({
          supplierId: '',
          supplierName: '',
          totalAmount: 0,
          type: 'standard',
          remarks: ''
        });
      } else {
        alert('创建采购单失败');
      }
    } catch (error) {
      console.error('Create PO failed:', error);
    }
  };

  const handleConfirmOrder = async (id: string) => {
    if (!confirm('确定要确认该采购单吗？确认后将不可修改。')) return;
    
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });

      if (res.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error('Confirm order failed:', error);
    }
  };

  const handleReceiveItems = async (order: PurchaseOrder) => {
    if (!confirm(`确定已收到采购单 ${order.orderNo} 的货物吗？`)) return;

    try {
      const res = await fetch('/api/purchase-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'inbound',
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          poNo: order.orderNo,
          recordDate: new Date().toISOString().split('T')[0],
          items: order.items,
        }),
      });

      if (res.ok) {
        alert('收货记录已创建');
        fetchOrders();
      } else {
        alert('确认收货失败');
      }
    } catch (error) {
      console.error('Receive items failed:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">草稿</Badge>;
      case 'confirmed': return <Badge variant="default" className="bg-blue-500 text-white">已确认</Badge>;
      case 'completed': return <Badge variant="outline" className="text-green-600 border-green-600">已完成</Badge>;
      case 'cancelled': return <Badge variant="destructive">已取消</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'prepaid' 
      ? <Badge variant="outline" className="text-amber-600 border-amber-600">预付</Badge>
      : <Badge variant="outline" className="text-gray-500 border-gray-500">标准</Badge>;
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-8 h-8 text-primary" />
            采购单管理
          </h1>
          <p className="text-muted-foreground mt-1">管理采购合同与订单，支持预付款流程</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            筛选
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建采购单
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>采购单列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">加载中...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">暂无采购单</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单编号</TableHead>
                  <TableHead>供应商</TableHead>
                  <TableHead>下单日期</TableHead>
                  <TableHead>订单金额</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>收货状态</TableHead>
                  <TableHead>付款状态</TableHead>
                  <TableHead>订单状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNo}</TableCell>
                    <TableCell>{order.supplierName}</TableCell>
                    <TableCell>{order.orderDate}</TableCell>
                    <TableCell>¥{order.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>{getTypeBadge(order.type)}</TableCell>
                    <TableCell>
                      {order.inboundStatus === 'received' ? '已收货' : '待收货'}
                    </TableCell>
                    <TableCell>
                      {order.paymentStatus === 'paid' ? (
                        <span className="text-green-600">已付清</span>
                      ) : order.paymentStatus === 'partial_paid' ? (
                        <span className="text-amber-600">部分支付</span>
                      ) : (
                        <span className="text-gray-400">未支付</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {order.status === 'draft' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleConfirmOrder(order.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            确认
                          </Button>
                        )}
                        {order.status === 'confirmed' && order.inboundStatus === 'pending' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReceiveItems(order)}
                          >
                            <Package className="w-4 h-4 mr-1" />
                            收货
                          </Button>
                        )}
                        {order.status === 'confirmed' && order.type === 'prepaid' && order.paymentStatus !== 'paid' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleOpenRequestDialog(order)}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            请款
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">详情</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建采购单弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建采购单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>供应商 *</Label>
              <Select
                value={newOrderData.supplierId}
                onValueChange={(v) => {
                  const supplier = suppliers.find(s => s.id === v);
                  setNewOrderData({
                    ...newOrderData,
                    supplierId: v,
                    supplierName: supplier?.name || ''
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
              <Label>订单类型</Label>
              <Select
                value={newOrderData.type}
                onValueChange={(v) => setNewOrderData({ ...newOrderData, type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">标准采购</SelectItem>
                  <SelectItem value="prepaid">预付采购</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>订单总额 *</Label>
              <Input
                type="number"
                value={newOrderData.totalAmount}
                onChange={(e) => setNewOrderData({ ...newOrderData, totalAmount: Number(e.target.value) })}
                placeholder="请输入订单总额"
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={newOrderData.remarks}
                onChange={(e) => setNewOrderData({ ...newOrderData, remarks: e.target.value })}
                placeholder="请输入备注信息"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateSubmit}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>发起采购请款 - {selectedOrder?.orderNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">供应商</Label>
              <div className="col-span-3 text-sm">{selectedOrder?.supplierName}</div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">订单金额</Label>
              <div className="col-span-3 text-sm font-medium">¥{selectedOrder?.totalAmount.toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">未付金额</Label>
              <div className="col-span-3 text-sm text-amber-600 font-medium">¥{selectedOrder?.unpaidAmount.toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">请款金额 *</Label>
              <Input
                id="amount"
                type="number"
                className="col-span-3"
                value={requestData.amount}
                onChange={(e) => setRequestData({ ...requestData, amount: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">备注</Label>
              <Textarea
                id="reason"
                className="col-span-3"
                value={requestData.reason}
                onChange={(e) => setRequestData({ ...requestData, reason: e.target.value })}
                placeholder="请输入请款事由"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>取消</Button>
            <Button onClick={handleRequestSubmit}>提交请款申请</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
