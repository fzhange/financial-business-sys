# 设计文档: 供应商对账付款流程

## Context

本系统为业务财务系统，需要实现完整的供应商对账付款流程。系统使用 Next.js 开发，数据存储使用本地 JSON 文件模拟数据库。

### 技术栈
- 前端: Next.js + React + shadcn/ui + Tailwind CSS
- 后端: Next.js API Routes
- 数据存储: 本地 JSON 文件

### 业务流程概述
1. 周期内采购交易产生收货/退货记录
2. 账期结束后生成供应商对账单
3. 双方核对确认对账结果
4. 确认后生成应付账款
5. 供应商开票，采购方录入发票
6. 发起请款申请
7. 财务审核后执行付款
8. 应付与实付进行核销

## Goals / Non-Goals

### Goals
- 实现完整的供应商对账付款业务流程
- 提供清晰的数据流转和状态管理
- 支持各环节的审批和确认机制
- 实现应付与实付的核销对账

### Non-Goals
- 不涉及采购订单(PO)的创建和管理（假设已存在）
- 不涉及供应商主数据管理
- 不涉及与外部系统的集成
- 不涉及复杂的权限控制

## Decisions

### 数据模型设计

#### 1. 采购入库/退货记录 (PurchaseRecord)
```typescript
interface PurchaseRecord {
  id: string;
  type: 'inbound' | 'return';  // 入库 | 退货
  recordNo: string;            // 单据编号
  supplierId: string;          // 供应商ID
  supplierName: string;        // 供应商名称
  poNo: string;                // 采购订单号
  recordDate: string;          // 单据日期
  items: PurchaseRecordItem[]; // 明细
  totalAmount: number;         // 总金额
  status: 'pending' | 'confirmed'; // 待确认 | 已确认
  createdAt: string;
  updatedAt: string;
}

interface PurchaseRecordItem {
  id: string;
  productCode: string;   // 物料编码
  productName: string;   // 物料名称
  specification: string; // 规格
  unit: string;          // 单位
  quantity: number;      // 数量
  unitPrice: number;     // 单价
  amount: number;        // 金额
}
```

#### 2. 供应商对账单 (SupplierStatement)
```typescript
interface SupplierStatement {
  id: string;
  statementNo: string;          // 对账单号
  supplierId: string;           // 供应商ID
  supplierName: string;         // 供应商名称
  periodStart: string;          // 账期开始
  periodEnd: string;            // 账期结束
  purchaseRecordIds: string[];  // 关联的采购记录ID
  totalInboundAmount: number;   // 入库总额
  totalReturnAmount: number;    // 退货总额
  netAmount: number;            // 净额（入库-退货）
  supplierAmount: number;       // 供应商对账金额
  differenceAmount: number;     // 差异金额
  status: 'draft' | 'pending_supplier_confirm' | 'disputed' | 'pending_buyer_confirm' | 'confirmed';
  // 草稿 | 待供应商确认 | 有争议 | 待采购方确认 | 已确认
  // 供应商确认（先）
  supplierConfirmed: boolean;   // 供应商是否已确认
  supplierConfirmedAt?: string; // 供应商确认时间
  // 采购方确认（后）
  buyerConfirmed: boolean;      // 采购方是否已确认
  buyerConfirmedAt?: string;    // 采购方确认时间
  buyerConfirmedBy?: string;    // 采购方确认人
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 3. 应付账款 (AccountsPayable)
```typescript
interface AccountsPayable {
  id: string;
  payableNo: string;            // 应付单号
  statementId: string;          // 关联对账单ID
  supplierId: string;           // 供应商ID
  supplierName: string;         // 供应商名称
  payableAmount: number;        // 应付金额
  paidAmount: number;           // 已付金额
  unpaidAmount: number;         // 未付金额 = 应付金额 - 已付金额
  invoicedAmount: number;       // 已开票金额
  verifiedAmount: number;       // 已核销金额
  unverifiedAmount: number;     // 未核销金额 = 应付金额 - 已核销金额
  paymentStatus: 'unpaid' | 'partial_paid' | 'paid';
  // 付款状态：未付款 | 部分付款 | 已付款
  verificationStatus: 'unverified' | 'partial_verified' | 'verified';
  // 核销状态：未核销 | 部分核销 | 已核销
  dueDate: string;              // 到期日
  createdAt: string;
  updatedAt: string;
}
```

**三单匹配核销说明：**
- **三单**：应付账款、付款记录、发票
- **核销规则**：三者金额匹配后，由财务人员手动确认核销
- **核销时机**：付款和开票顺序不限，只要金额匹配即可
- **核销粒度**：支持部分核销，可多次核销

#### 4. 发票 (Invoice)
```typescript
interface Invoice {
  id: string;
  invoiceNo: string;            // 发票号码
  invoiceCode: string;          // 发票代码
  invoiceType: 'vat_special' | 'vat_normal' | 'other';
  // 增值税专用发票 | 增值税普通发票 | 其他
  supplierId: string;           // 供应商ID
  supplierName: string;         // 供应商名称
  sellerName: string;           // 销售方名称
  sellerTaxNo: string;          // 销售方税号
  // 注意：发票与应付账款为多对多关系，通过 InvoicePayableRelation 关联
  amount: number;               // 金额（不含税）
  taxAmount: number;            // 税额
  totalAmount: number;          // 价税合计
  invoiceDate: string;          // 开票日期
  receivedDate: string;         // 收票日期
  inputMethod: 'manual' | 'ocr' | 'electronic_import';
  // 手工录入 | OCR识别 | 电子发票导入
  originalFilePath?: string;    // 原始文件路径（OCR图片或电子发票文件）
  authenticityStatus: 'pending' | 'verified' | 'failed';
  // 真伪校验状态：待验证 | 已验真 | 验证失败
  authenticityVerifiedAt?: string;  // 真伪校验时间
  usable: boolean;              // 可用状态：true=可用, false=不可用
  unusableReason?: string;      // 不可用原因（不可用时必填）
  verifiedAt?: string;          // 校验时间
  verifiedBy?: string;          // 校验人
  // 核销相关字段
  verifiedAmount: number;       // 已核销金额
  unverifiedAmount: number;     // 未核销金额 = totalAmount - verifiedAmount
  verificationStatus: 'unverified' | 'partial_verified' | 'verified';
  // 核销状态：未核销 | 部分核销 | 已核销
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

// 发票-应付账款关联表（多对多）
interface InvoicePayableRelation {
  id: string;
  invoiceId: string;            // 发票ID
  payableId: string;            // 应付账款ID
  allocatedAmount: number;      // 分摊金额（该发票对应该应付的金额）
  createdAt: string;
}
```

#### 5. 请款单 (PaymentRequest)
```typescript
interface PaymentRequest {
  id: string;
  requestNo: string;            // 请款单号
  payableIds: string[];         // 关联应付账款ID列表（支持多个）
  invoiceIds: string[];         // 关联发票ID列表
  supplierId: string;           // 供应商ID
  supplierName: string;         // 供应商名称
  requestAmount: number;        // 请款金额
  paidAmount: number;           // 已付金额
  unpaidAmount: number;         // 未付金额 = 请款金额 - 已付金额
  requestReason: string;        // 请款事由
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'paid';
  // 草稿 | 待审批 | 已审批 | 已拒绝 | 已付款
  submittedAt?: string;
  submittedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalRemarks?: string;
  createdAt: string;
  updatedAt: string;
}
```

**请款单付款规则：**
1. **付款入口**：仅"已审批"状态且 unpaidAmount > 0 的请款单显示"发起付款"按钮
2. **付款金额**：付款金额 ≤ unpaidAmount（未付金额）
3. **部分付款**：支持分多次付款，每次付款后更新 paidAmount 和 unpaidAmount
4. **状态变更**：
   - 部分付款后：状态保持"已审批"
   - 全部付清后：状态变为"已付款"
5. **无需审批**：付款操作无需二次审批，付款完成即生成付款单

#### 6. 付款单 (PaymentOrder)
```typescript
interface PaymentOrder {
  id: string;
  orderNo: string;              // 付款单号
  requestId: string;            // 关联请款单ID
  payableId: string;            // 关联应付账款ID
  supplierId: string;           // 供应商ID
  supplierName: string;         // 供应商名称
  paymentAmount: number;        // 付款金额
  paymentMethod: 'bank_transfer' | 'check' | 'cash' | 'other';
  // 银行转账 | 支票 | 现金 | 其他
  bankAccount?: string;         // 收款账号
  bankName?: string;            // 收款银行
  paymentDate: string;          // 付款日期
  status: 'completed' | 'failed';
  // 已完成 | 付款失败（付款完成后生成，无中间状态）
  // 核销相关字段
  verifiedAmount: number;       // 已核销金额
  unverifiedAmount: number;     // 未核销金额 = paymentAmount - verifiedAmount
  verificationStatus: 'unverified' | 'partial_verified' | 'verified';
  // 核销状态：未核销 | 部分核销 | 已核销
  completedAt?: string;
  transactionNo?: string;       // 交易流水号
  failureReason?: string;       // 失败原因（状态为failed时）
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}
```

**付款单生成规则：**
1. **生成时机**：付款完成后生成，不再有"待付款"、"付款中"等中间状态
2. **状态说明**：
   - `completed`：付款成功
   - `failed`：付款失败，需记录失败原因
3. **核销状态说明**：
   - `unverified`：未核销（已核销金额 = 0）
   - `partial_verified`：部分核销（0 < 已核销金额 < 付款金额）
   - `verified`：已核销（已核销金额 = 付款金额）
4. **无需审批**：基于已审批请款单付款，付款操作本身无需审批
5. **联动更新**：付款成功后自动更新请款单和应付账款的已付金额

#### 7. 核销记录 (VerificationRecord)
```typescript
interface VerificationRecord {
  id: string;
  verificationNo: string;       // 核销单号
  payableId: string;            // 关联应付账款ID
  paymentOrderId: string;       // 关联付款单ID
  invoiceId: string;            // 关联发票ID
  amount: number;               // 核销金额
  verificationDate: string;     // 核销日期
  verifiedBy: string;           // 核销人
  verifiedAt: string;           // 核销时间
  status: 'completed' | 'reversed';  // 已完成 | 已冲销
  remarks?: string;
  // 冲销相关字段
  reversedAt?: string;          // 冲销时间
  reversedBy?: string;          // 冲销人
  reverseReasonType?: 'input_error' | 'business_change' | 'duplicate_verification' | 'invoice_return' | 'other';
  // 冲销原因类型：录入错误 | 业务变更 | 重复核销 | 发票退回 | 其他
  reverseReasonDetail?: string; // 冲销原因详细说明
  createdAt: string;
  updatedAt: string;
}
```

**核销业务规则：**
1. **三单匹配**：核销时必须同时关联应付账款、付款单、发票
2. **金额约束**：核销金额 ≤ min(该应付账款未核销付款金额, 该应付账款未核销发票金额)
3. **手动操作**：核销需财务人员手动确认，选择付款记录 + 发票 + 金额
4. **部分核销**：支持多次部分核销，直到应付账款全部核销完成
5. **顺序无关**：付款和开票顺序不限，只要三者金额匹配即可核销

**冲销业务规则：**
1. **权限控制**：仅财务主管及以上角色可执行冲销操作
2. **原因必填**：冲销时必须选择原因类型并填写详细说明（至少10个字符）
3. **时间限制**：
   - 当月内的核销可直接冲销
   - 跨月核销需提交审批
   - 已结账会计期间的核销禁止冲销
4. **联动更新**：冲销后自动恢复发票、应付账款、付款单的未核销金额
5. **不可重复**：已冲销的记录不可再次冲销
6. **记录保留**：冲销后保留原核销记录，状态更新为"已冲销"

### API 设计

采用 RESTful 风格设计 API：

| 模块 | API 路径 | 方法 | 说明 |
|------|---------|------|------|
| 采购记录 | `/api/purchase-records` | GET/POST | 列表/新增 |
| 采购记录 | `/api/purchase-records/[id]` | GET/PUT/DELETE | 详情/更新/删除 |
| 对账单 | `/api/supplier-statements` | GET/POST | 列表/新增 |
| 对账单 | `/api/supplier-statements/[id]` | GET/PUT | 详情/更新 |
| 对账单 | `/api/supplier-statements/[id]/confirm` | POST | 确认 |
| 应付账款 | `/api/accounts-payable` | GET/POST | 列表/新增 |
| 应付账款 | `/api/accounts-payable/[id]` | GET/PUT | 详情/更新 |
| 应付账款 | `/api/accounts-payable/[id]/verifications` | GET/POST | 核销记录列表/新增核销 |
| 应付账款 | `/api/accounts-payable/[id]/verifications/[vid]` | GET | 核销记录详情 |
| 应付账款 | `/api/accounts-payable/[id]/verifications/[vid]/reverse` | POST | 核销冲销 |
| 发票 | `/api/invoices` | GET/POST | 列表/新增(含重复校验) |
| 发票 | `/api/invoices/[id]` | GET/PUT/DELETE | 详情/更新/删除 |
| 发票 | `/api/invoices/[id]/verify` | POST | 业务校验 |
| 发票 | `/api/invoices/[id]/authenticate` | POST | 真伪校验 |
| 发票 | `/api/invoices/ocr` | POST | OCR识别 |
| 发票 | `/api/invoices/import` | POST | 电子发票批量导入 |
| 请款单 | `/api/payment-requests` | GET/POST | 列表/新增 |
| 请款单 | `/api/payment-requests/[id]` | GET/PUT | 详情/更新 |
| 请款单 | `/api/payment-requests/[id]/submit` | POST | 提交 |
| 请款单 | `/api/payment-requests/[id]/approve` | POST | 审批 |
| 付款单 | `/api/payment-orders` | GET/POST | 列表/新增 |
| 付款单 | `/api/payment-orders/[id]` | GET/PUT | 详情/更新 |
| 付款单 | `/api/payment-orders/[id]/complete` | POST | 完成付款 |

### 页面设计

| 页面 | 路径 | 说明 |
|------|------|------|
| 采购记录 | `/purchase-records` | 入库/退货记录列表 |
| 对账单 | `/supplier-statements` | 对账单列表及管理 |
| 应付账款 | `/accounts-payable` | 应付账款列表（含核销操作） |
| 发票管理 | `/invoices` | 发票录入和管理 |
| 请款管理 | `/payment-requests` | 请款单列表和审批 |
| 付款单 | `/payment-orders` | 付款单列表 |

**注：** 三单核销功能集成在应付账款详情页，不单独设立核销管理模块。

## Risks / Trade-offs

### 风险
1. **数据一致性**: JSON 文件存储不支持事务，需要在代码层面保证数据一致性
   - 缓解措施：关键操作使用文件锁，失败时进行回滚

2. **并发处理**: JSON 文件不适合高并发场景
   - 缓解措施：本项目为演示系统，不考虑高并发场景

### Trade-offs
1. **简单性 vs 完整性**: 为保持实现简单，部分复杂功能（如多级审批、复杂权限）暂不实现
2. **JSON 文件 vs 真实数据库**: 使用 JSON 文件便于开发和演示，但不适合生产环境

## Migration Plan

本项目为新建功能，无需数据迁移。

### 初始化数据
需要创建以下 JSON 数据文件：
- `data/purchase-records.json`
- `data/supplier-statements.json`
- `data/accounts-payable.json`
- `data/invoices.json`
- `data/payment-requests.json`
- `data/payment-orders.json`
- `data/verifications.json` (核销记录，作为应付账款的子资源)
- `data/suppliers.json` (基础数据)

## Open Questions

1. 是否需要支持多币种？（当前假设：单一币种 CNY）
2. ~~是否需要支持部分核销？~~（**已确认：支持部分核销**）
3. 付款审批流程是否需要多级审批？（当前假设：单级审批）
