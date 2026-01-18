# 任务清单: 供应商对账付款流程

## 1. 基础设施
- [ ] 1.1 创建数据目录 `data/` 和基础 JSON 文件
- [ ] 1.2 创建 JSON 文件读写工具函数 `lib/db.ts`
- [ ] 1.3 创建供应商基础数据 `data/suppliers.json` 及测试数据

## 2. 采购入库/退货记录模块
- [ ] 2.1 创建数据文件 `data/purchase-records.json`
- [ ] 2.2 实现 API: `app/api/purchase-records/route.ts` (GET/POST)
- [ ] 2.3 实现 API: `app/api/purchase-records/[id]/route.ts` (GET/PUT/DELETE)
- [ ] 2.4 创建采购记录列表页面 `app/purchase-records/page.tsx`
- [ ] 2.5 创建采购记录详情/编辑组件

## 3. 供应商对账单模块
- [ ] 3.1 创建数据文件 `data/supplier-statements.json`
- [ ] 3.2 实现 API: `app/api/supplier-statements/route.ts` (GET/POST)
- [ ] 3.3 实现 API: `app/api/supplier-statements/[id]/route.ts` (GET/PUT)
- [ ] 3.4 实现 API: `app/api/supplier-statements/[id]/confirm/route.ts` (POST)
- [ ] 3.5 创建对账单列表页面 `app/supplier-statements/page.tsx`
- [ ] 3.6 创建对账单详情页面（含核对功能）

## 4. 应付账款模块
- [ ] 4.1 创建数据文件 `data/accounts-payable.json`
- [ ] 4.2 实现 API: `app/api/accounts-payable/route.ts` (GET/POST)
- [ ] 4.3 实现 API: `app/api/accounts-payable/[id]/route.ts` (GET/PUT)
- [ ] 4.4 创建应付账款列表页面 `app/accounts-payable/page.tsx`
- [ ] 4.5 创建应付账款详情页面

## 5. 发票管理模块
- [ ] 5.1 创建数据文件 `data/invoices.json` 和 `data/invoice-payable-relations.json`（多对多关联表）
- [ ] 5.2 实现 API: `app/api/invoices/route.ts` (GET/POST - 含重复校验)
- [ ] 5.3 实现 API: `app/api/invoices/[id]/route.ts` (GET/PUT/DELETE)
- [ ] 5.4 实现 API: `app/api/invoices/[id]/payables/route.ts` (GET/POST/DELETE - 管理发票与应付账款关联)
- [ ] 5.5 实现 API: `app/api/invoices/[id]/verify/route.ts` (POST - 业务校验)
- [ ] 5.6 实现 API: `app/api/invoices/[id]/authenticate/route.ts` (POST - 真伪校验)
- [ ] 5.7 实现 API: `app/api/invoices/ocr/route.ts` (POST - OCR识别)
- [ ] 5.8 实现 API: `app/api/invoices/import/route.ts` (POST - 电子发票导入)
- [ ] 5.9 创建发票管理列表页面 `app/invoices/page.tsx`
- [ ] 5.10 创建发票手工录入表单组件（支持多应付账款关联）
- [ ] 5.11 创建OCR识别上传组件
- [ ] 5.12 创建电子发票批量导入组件
- [ ] 5.13 创建发票校验功能（真伪校验+业务校验）

## 6. 请款管理模块
- [ ] 6.1 创建数据文件 `data/payment-requests.json`
- [ ] 6.2 实现 API: `app/api/payment-requests/route.ts` (GET/POST)
- [ ] 6.3 实现 API: `app/api/payment-requests/[id]/route.ts` (GET/PUT)
- [ ] 6.4 实现 API: `app/api/payment-requests/[id]/submit/route.ts` (POST)
- [ ] 6.5 实现 API: `app/api/payment-requests/[id]/approve/route.ts` (POST)
- [ ] 6.6 创建请款单列表页面 `app/payment-requests/page.tsx`
- [ ] 6.7 创建请款详情和审批功能

## 7. 付款单模块
- [ ] 7.1 创建数据文件 `data/payment-orders.json`
- [ ] 7.2 实现 API: `app/api/payment-orders/route.ts` (GET/POST)
- [ ] 7.3 实现 API: `app/api/payment-orders/[id]/route.ts` (GET/PUT)
- [ ] 7.4 实现 API: `app/api/payment-orders/[id]/complete/route.ts` (POST)
- [ ] 7.5 创建付款单列表页面 `app/payment-orders/page.tsx`
- [ ] 7.6 创建付款操作功能

## 8. 核销管理模块
- [ ] 8.1 创建数据文件 `data/write-offs.json`
- [ ] 8.2 实现 API: `app/api/write-offs/route.ts` (GET/POST)
- [ ] 8.3 实现 API: `app/api/write-offs/[id]/route.ts` (GET)
- [ ] 8.4 创建核销列表页面 `app/write-offs/page.tsx`
- [ ] 8.5 创建核销操作功能（自动/手工核销）

## 9. 导航和布局
- [ ] 9.1 创建应用布局组件 `app/layout.tsx` (含侧边栏导航)
- [ ] 9.2 创建首页仪表盘 `app/page.tsx` (展示关键数据摘要)

## 10. 验证和测试
- [ ] 10.1 验证完整业务流程：采购记录 -> 对账 -> 应付 -> 发票 -> 请款 -> 付款 -> 核销
- [ ] 10.2 检验各模块数据联动正确性
- [ ] 10.3 添加必要的表单验证

## 依赖关系
```
1.基础设施
    ↓
2.采购记录 ← 3.对账单 ← 4.应付账款 ← 5.发票 ← 6.请款 ← 7.付款 ← 8.核销
    ↓
9.导航布局
    ↓
10.验证测试
```

## 可并行任务
- 任务 2-8 的数据文件创建和 API 实现可以并行进行（完成基础设施后）
- 各模块的页面开发可以在对应 API 完成后并行进行
