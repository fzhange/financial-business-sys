'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Package,
  FileText,
  Wallet,
  Receipt,
  FileCheck,
  CreditCard,
  ShoppingCart,
} from 'lucide-react';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/purchase-orders', label: '采购单管理', icon: ShoppingCart },
  { href: '/purchase-records', label: '采购记录', icon: Package },
  { href: '/supplier-statements', label: '供应商对账', icon: FileText },
  { href: '/accounts-payable', label: '应付账款', icon: Wallet },
  { href: '/invoices', label: '发票管理', icon: Receipt },
  { href: '/payment-requests', label: '请款管理', icon: FileCheck },
  { href: '/payment-orders', label: '付款单', icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed left-0 top-0 w-64 h-screen bg-white border-r flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-gray-900">业务财务系统</h1>
        <p className="text-sm text-gray-500 mt-1">供应商对账付款</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t text-xs text-gray-400">
        v1.0.0
      </div>
    </div>
  );
}
