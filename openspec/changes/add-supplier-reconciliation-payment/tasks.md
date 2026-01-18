# 任务清单: 供应商对账付款流程

## 1. 基础设施
- [x] 1.1 创建数据目录 `data/` 和基础 JSON 文件
- [x] 1.2 创建 JSON 文件读写工具函数 `lib/db.ts`
- [x] 1.3 创建供应商基础数据 `data/suppliers.json` 及测试数据

## 2. 采购入库/退货记录模块
- [x] 2.1 创建数据文件 `data/purchase-records.json`
- [x] 2.2 实现 API: `app/api/purchase-records/route.ts` (GET/POST)
- [x] 2.3 实现 API: `app/api/purchase-records/[id]/route.ts` (GET/PUT/DELETE)
- [x] 2.4 创建采购记录列表页面 `app/purchase-records/page.tsx`
- [x] 2.5 创建采购记录详情/编辑组件

## 3. 供应商对账单模块
- [x] 3.1 创建数据文件 `data/supplier-statements.json`
- [x] 3.2 实现 API: `app/api/supplier-statements/route.ts` (GET/POST)
- [x] 3.3 实现 API: `app/api/supplier-statements/[id]/route.ts` (GET/PUT)
- [x] 3.4 实现 API: `app/api/supplier-statements/[id]/confirm/route.ts` (POST)
- [x] 3.5 创建对账单列表页面 `app/supplier-statements/page.tsx`
- [x] 3.6 创建对账单详情页面（含核对功能）

## 4. 应付账款模块
- [x] 4.1 创建数据文件 `data/accounts-payable.json` 和 `data/verifications.json`
- [x] 4.2 实现 API: `app/api/accounts-payable/route.ts` (GET/POST)
- [x] 4.3 实现 API: `app/api/accounts-payable/[id]/route.ts` (GET/PUT)
- [x] 4.4 实现 API: `app/api/accounts-payable/[id]/verifications/route.ts` (GET/POST - 核销记录)
- [x] 4.5 实现 API: `app/api/accounts-payable/[id]/verifications/[vid]/route.ts` (GET - 核销详情)
- [x] 4.6 实现 API: `app/api/accounts-payable/[id]/verifications/[vid]/reverse/route.ts` (POST - 冲销)
- [x] 4.7 创建应付账款列表页面 `app/accounts-payable/page.tsx`
- [x] 4.8 创建应付账款详情页面（含三单核销操作）

## 5. 发票管理模块
- [x] 5.1 创建数据文件 `data/invoices.json` 和 `data/invoice-payable-relations.json`（多对多关联表）
- [x] 5.2 实现 API: `app/api/invoices/route.ts` (GET/POST - 含重复校验)
- [x] 5.3 实现 API: `app/api/invoices/[id]/route.ts` (GET/PUT/DELETE)
- [x] 5.4 实现 API: `app/api/invoices/[id]/payables/route.ts` (GET/POST/DELETE - 管理发票与应付账款关联)
- [x] 5.5 实现 API: `app/api/invoices/[id]/verify/route.ts` (POST - 业务校验)
- [x] 5.6 实现 API: `app/api/invoices/[id]/authenticate/route.ts` (POST - 真伪校验)
- [ ] 5.7 实现 API: `app/api/invoices/ocr/route.ts` (POST - OCR识别) - 可后续扩展
- [ ] 5.8 实现 API: `app/api/invoices/import/route.ts` (POST - 电子发票导入) - 可后续扩展
- [x] 5.9 创建发票管理列表页面 `app/invoices/page.tsx`
- [x] 5.10 创建发票手工录入表单组件（支持多应付账款关联）
- [ ] 5.11 创建OCR识别上传组件 - 可后续扩展
- [ ] 5.12 创建电子发票批量导入组件 - 可后续扩展
- [x] 5.13 创建发票校验功能（真伪校验+业务校验）

## 6. 请款管理模块
- [x] 6.1 创建数据文件 `data/payment-requests.json`
- [x] 6.2 实现 API: `app/api/payment-requests/route.ts` (GET/POST)
- [x] 6.3 实现 API: `app/api/payment-requests/[id]/route.ts` (GET/PUT)
- [x] 6.4 实现 API: `app/api/payment-requests/[id]/submit/route.ts` (POST)
- [x] 6.5 实现 API: `app/api/payment-requests/[id]/approve/route.ts` (POST)
- [x] 6.6 创建请款单列表页面 `app/payment-requests/page.tsx`
- [x] 6.7 创建请款详情和审批功能

## 7. 付款单模块
- [x] 7.1 创建数据文件 `data/payment-orders.json`
- [x] 7.2 实现 API: `app/api/payment-orders/route.ts` (GET/POST)
- [x] 7.3 实现 API: `app/api/payment-orders/[id]/route.ts` (GET/PUT)
- [x] 7.4 实现 API: `app/api/payment-requests/[id]/pay/route.ts` (POST - 通过请款单发起付款)
- [x] 7.5 创建付款单列表页面 `app/payment-orders/page.tsx`
- [x] 7.6 创建付款操作功能

## 8. 导航和布局
- [x] 8.1 创建应用布局组件 `app/layout.tsx` (含侧边栏导航)
- [x] 8.2 创建首页仪表盘 `app/page.tsx` (展示关键数据摘要)

## 9. 验证和测试
- [x] 9.1 验证完整业务流程：采购记录 -> 对账 -> 应付 -> 发票 -> 请款 -> 付款 -> 核销
- [x] 9.2 检验各模块数据联动正确性
- [x] 9.3 添加必要的表单验证

## 依赖关系
```
1.基础设施
    ↓
2.采购记录 ← 3.对账单 ← 4.应付账款(含核销) ← 5.发票 ← 6.请款 ← 7.付款
    ↓
8.导航布局
    ↓
9.验证测试
```

## 可并行任务
- 任务 2-8 的数据文件创建和 API 实现可以并行进行（完成基础设施后）
- 各模块的页面开发可以在对应 API 完成后并行进行

## 后续扩展
- OCR 识别发票功能
- 电子发票批量导入功能
