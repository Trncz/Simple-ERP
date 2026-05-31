/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  defaultPrice: number;
  defaultCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

// Purchase Order
export type PurchaseOrderStatus = 'Draft' | 'Submitted' | 'Partial' | 'Completed';

export interface PurchaseOrderItem {
  id: string;
  itemId: string;
  itemName?: string; // Resolved helper name
  itemCode?: string; // Resolved helper code
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQty?: number; // ADDED
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string; // Resolved helper name
  orderDate: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
  remarks?: string;
  totalAmount: number;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

// Goods Receipt
export interface GoodsReceiptItem {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  receivedQty: number;
  invoicedQty?: number; // ADDED to track invoiced amount
  sourcePoId?: string; // ADDED
  sourcePoNumber?: string; // ADDED
  sourcePoItemId?: string; // ADDED
  orderedQty?: number; // ADDED
  previouslyReceivedQty?: number; // ADDED
  remainingQty?: number; // ADDED
}

export interface GoodsReceipt {
  id: string;
  grNumber: string;
  poId?: string; // made optional
  poNumber?: string; // made optional
  supplierId?: string; // ADDED
  supplierName?: string; // ADDED
  warehouseId: string;
  warehouseName?: string; // Resolved helper
  receiptDate: string;
  remarks?: string;
  items: GoodsReceiptItem[];
  createdAt: string;
}

// Purchase Invoice
export type PurchaseInvoiceStatus = 'Draft' | 'Unpaid' | 'Paid';

export interface PurchaseInvoiceItem {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  quantity: number;
  price: number;
  total: number;
  sourceGrId?: string; // ADDED
  sourceGrNumber?: string; // ADDED
  sourceGrItemId?: string; // ADDED
  receivedQty?: number; // ADDED
  previouslyInvoicedQty?: number; // ADDED
}

export interface PurchaseInvoice {
  id: string;
  piNumber: string;
  supplierId: string;
  supplierName?: string;
  poId?: string;
  poNumber?: string;
  invoiceDate: string;
  dueDate: string;
  status: PurchaseInvoiceStatus;
  remarks?: string;
  totalAmount: number;
  items: PurchaseInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

// Sales Order
export type SalesOrderStatus = 'Draft' | 'Submitted' | 'Partial' | 'Completed';

export interface SalesOrderItem {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  deliveredQty?: number; // ADDED
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  customerName?: string;
  orderDate: string;
  deliveryDate: string;
  status: SalesOrderStatus;
  remarks?: string;
  totalAmount: number;
  items: SalesOrderItem[];
  createdAt: string;
  updatedAt: string;
}

// Delivery Order
export interface DeliveryOrderItem {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  deliveredQty: number;
  invoicedQty?: number; // ADDED to track invoiced amount
  sourceSoId?: string; // ADDED
  sourceSoNumber?: string; // ADDED
  sourceSoItemId?: string; // ADDED
  orderedQty?: number; // ADDED
  previouslyDeliveredQty?: number; // ADDED
  remainingQty?: number; // ADDED
}

export interface DeliveryOrder {
  id: string;
  doNumber: string;
  soId?: string; // made optional
  soNumber?: string; // made optional
  customerId?: string; // ADDED
  customerName?: string; // ADDED
  warehouseId: string;
  warehouseName?: string; // Resolved helper
  deliveryDate: string;
  remarks?: string;
  items: DeliveryOrderItem[];
  createdAt: string;
}

// Sales Invoice
export type SalesInvoiceStatus = 'Draft' | 'Unpaid' | 'Paid';

export interface SalesInvoiceItem {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  quantity: number;
  price: number;
  total: number;
  sourceDoId?: string; // ADDED
  sourceDoNumber?: string; // ADDED
  sourceDoItemId?: string; // ADDED
  deliveredQty?: number; // ADDED
  previouslyInvoicedQty?: number; // ADDED
}

export interface SalesInvoice {
  id: string;
  siNumber: string;
  customerId: string;
  customerName?: string;
  soId?: string;
  soNumber?: string;
  invoiceDate: string;
  dueDate: string;
  status: SalesInvoiceStatus;
  remarks?: string;
  totalAmount: number;
  items: SalesInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

// Payments System
export interface ReceivablePayment {
  id: string;
  paymentNumber: string;
  customerId: string;
  customerName?: string;
  invoiceId: string;
  invoiceNumber?: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  remarks?: string;
  createdAt: string;
}

export interface PayablePayment {
  id: string;
  paymentNumber: string;
  supplierId: string;
  supplierName?: string;
  invoiceId: string;
  invoiceNumber?: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  remarks?: string;
  createdAt: string;
}

// Stock Movement
export interface StockMovement {
  id: string;
  date: string;
  type: 'GR' | 'DO' | 'Initial';
  refNo: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  warehouseId: string;
  warehouseName?: string;
  qtyIn: number;
  qtyOut: number;
  balanceAfter: number;
  remarks?: string;
  createdAt: string;
}

// Warehouse Stock
export interface WarehouseStock {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  warehouseId: string;
  warehouseName?: string;
  currentQty: number;
  updatedAt: string;
}

// API Pagination Response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
