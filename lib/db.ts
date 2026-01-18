import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// 通用读取 JSON 文件
export async function readJsonFile<T>(filename: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // 文件不存在时返回空数组
    return [];
  }
}

// 通用写入 JSON 文件
export async function writeJsonFile<T>(filename: string, data: T[]): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 生成单号（带前缀）
export function generateNo(prefix: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${dateStr}${random}`;
}

// 获取当前时间戳
export function now(): string {
  return new Date().toISOString();
}

// 类型定义
export interface PurchaseRecordItem {
  id: string;
  productCode: string;
  productName: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PurchaseRecord {
  id: string;
  type: 'inbound' | 'return';
  recordNo: string;
  supplierId: string;
  supplierName: string;
  poNo: string;
  recordDate: string;
  items: PurchaseRecordItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed';
  createdAt: string;
  updatedAt: string;
}

export interface SupplierStatement {
  id: string;
  statementNo: string;
  supplierId: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
  purchaseRecordIds: string[];
  totalInboundAmount?: number;
  totalPurchaseAmount?: number; // 入库总额
  totalReturnAmount: number;
  netAmount: number;
  supplierAmount?: number; // 供应商对账金额
  differenceAmount?: number; // 差异金额 = 供应商金额 - 采购方净额
  status: 'draft' | 'pending_supplier_confirm' | 'disputed' | 'pending_buyer_confirm' | 'confirmed';
  supplierConfirmed: boolean;
  supplierConfirmedAt?: string;
  buyerConfirmed: boolean;
  buyerConfirmedAt?: string;
  buyerConfirmedBy?: string;
  disputeReason?: string; // 争议原因
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsPayable {
  id: string;
  payableNo: string;
  statementId: string;
  supplierId: string;
  supplierName: string;
  payableAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  invoicedAmount: number;
  verifiedAmount: number;
  unverifiedAmount: number;
  paymentStatus: 'unpaid' | 'partial_paid' | 'paid';
  verificationStatus: 'unverified' | 'partial_verified' | 'verified';
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceCode: string;
  invoiceType: 'vat_special' | 'vat_normal' | 'other';
  supplierId: string;
  supplierName: string;
  sellerName: string;
  sellerTaxNo: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  invoiceDate: string;
  receivedDate: string;
  inputMethod: 'manual' | 'ocr' | 'electronic_import';
  originalFilePath?: string;
  authenticityStatus: 'pending' | 'verified' | 'failed';
  authenticityVerifiedAt?: string;
  usable: boolean;
  unusableReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedAmount: number;
  unverifiedAmount: number;
  verificationStatus: 'unverified' | 'partial_verified' | 'verified';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayableRelation {
  id: string;
  invoiceId: string;
  payableId: string;
  allocatedAmount: number;
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  requestNo: string;
  payableIds: string[];
  invoiceIds: string[];
  purchaseOrderId?: string; // 如果是预付类型的采购单，关联采购单
  supplierId: string;
  supplierName: string;
  requestAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  requestReason: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'paid';
  submittedAt?: string;
  submittedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOrder {
  id: string;
  orderNo: string;
  requestId: string;
  payableId: string;
  supplierId: string;
  supplierName: string;
  paymentAmount: number;
  paymentMethod: 'bank_transfer' | 'check' | 'cash' | 'other';
  bankAccount?: string;
  bankName?: string;
  paymentDate: string;
  status: 'completed' | 'failed';
  verifiedAmount: number;
  unverifiedAmount: number;
  verificationStatus: 'unverified' | 'partial_verified' | 'verified';
  completedAt?: string;
  transactionNo?: string;
  failureReason?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

// 核销明细 - 记录每个付款单的具体核销金额
export interface PaymentOrderVerificationDetail {
  paymentOrderId: string;
  amount: number; // 该付款单在本次核销中的金额
}

// 核销明细 - 记录每张发票的具体核销金额
export interface InvoiceVerificationDetail {
  invoiceId: string;
  amount: number; // 该发票在本次核销中的金额
}

export interface VerificationRecord {
  id: string;
  verificationNo: string;
  payableId: string;
  paymentOrderId: string;
  paymentOrderIds?: string[]; // 支持多选付款单（向后兼容）
  invoiceId: string;
  invoiceIds?: string[]; // 支持多选发票（向后兼容）
  // 新增：核销明细，记录每个付款单/发票的具体核销金额
  paymentOrderDetails?: PaymentOrderVerificationDetail[];
  invoiceDetails?: InvoiceVerificationDetail[];
  amount: number;
  verificationDate: string;
  verifiedBy: string;
  verifiedAt: string;
  status: 'completed' | 'reversed';
  verificationType?: 'auto' | 'manual'; // 核销类型：自动/手动
  remarks?: string;
  reversedAt?: string;
  reversedBy?: string;
  reverseReasonType?: 'input_error' | 'business_change' | 'duplicate_verification' | 'invoice_return' | 'other';
  reverseReasonDetail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  totalAmount: number;
  type: 'standard' | 'prepaid';
  paymentStatus: 'unpaid' | 'partial_paid' | 'paid';
  paidAmount: number;
  unpaidAmount: number;
  inboundStatus: 'pending' | 'received' | 'partially_received';
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled';
  items: PurchaseRecordItem[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankAccount: string;
  taxNo: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}
