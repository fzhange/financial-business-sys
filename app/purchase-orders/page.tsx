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
import { ShoppingCart, Plus, Filter } from 'lucide-react';
import { PurchaseOrder } from '@/lib/db';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
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
          <Button>
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
                      <Button variant="ghost" size="sm">详情</Button>
                      {order.type === 'prepaid' && order.paymentStatus !== 'paid' && (
                        <Button variant="outline" size="sm" className="ml-2">请款</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
