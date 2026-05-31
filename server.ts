/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/dbStore';
import {
  Item,
  Customer,
  Supplier,
  Warehouse,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  SalesOrder,
  SalesOrderItem,
  DeliveryOrder,
  DeliveryOrderItem,
  SalesInvoice,
  SalesInvoiceItem,
  ReceivablePayment,
  PayablePayment
} from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// Simple Auth Middleware
const AUTH_TOKEN = 'simple-erp-mock-jwt-session-token-2026';
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
  next();
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Allow any login for simplicity/local testing, but validate admin/demo credentials if wanted
  if (username === 'admin' && password === 'admin') {
    return res.json({
      token: AUTH_TOKEN,
      user: { id: 'usr-1', username: 'admin', name: 'ERP Administrator', role: 'admin' }
    });
  } else {
    // Elegant fallback to accept any valid testing user
    return res.json({
      token: AUTH_TOKEN,
      user: { id: `usr-${Date.now()}`, username, name: `${username.charAt(0).toUpperCase() + username.slice(1)} (Demo)`, role: 'user' }
    });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ id: 'usr-1', username: 'admin', name: 'ERP Administrator', role: 'admin' });
});


// ==========================================
// 2. MASTER DATA ENDPOINTS: ITEMS
// ==========================================
app.get('/api/items', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let filtered = data.items;
  if (search) {
    filtered = data.items.filter(it => 
      it.code.toLowerCase().includes(search) || 
      it.name.toLowerCase().includes(search) ||
      (it.description && it.description.toLowerCase().includes(search))
    );
  }

  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.post('/api/items', authenticate, (req, res) => {
  const data = db.getData();
  const { code, name, description, unit, defaultPrice, defaultCost } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Item code and name are required' });
  }

  if (data.items.some(it => it.code.toUpperCase() === code.toUpperCase())) {
    return res.status(400).json({ error: `Item with code ${code} already exists` });
  }

  const newItem: Item = {
    id: `item-${Date.now()}`,
    code: code.toUpperCase(),
    name,
    description,
    unit: unit || 'pcs',
    defaultPrice: Number(defaultPrice) || 0,
    defaultCost: Number(defaultCost) || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.items.push(newItem);
  db.save();
  res.status(201).json(newItem);
});

app.put('/api/items/:id', authenticate, (req, res) => {
  const data = db.getData();
  const item = data.items.find(it => it.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { code, name, description, unit, defaultPrice, defaultCost } = req.body;

  if (code && code.toUpperCase() !== item.code && data.items.some(it => it.code.toUpperCase() === code.toUpperCase() && it.id !== item.id)) {
    return res.status(400).json({ error: `Item with code ${code} already exists` });
  }

  if (code) item.code = code.toUpperCase();
  if (name !== undefined) item.name = name;
  if (description !== undefined) item.description = description;
  if (unit !== undefined) item.unit = unit;
  if (defaultPrice !== undefined) item.defaultPrice = Number(defaultPrice) || 0;
  if (defaultCost !== undefined) item.defaultCost = Number(defaultCost) || 0;
  item.updatedAt = new Date().toISOString();

  db.save();
  res.json(item);
});

app.delete('/api/items/:id', authenticate, (req, res) => {
  const data = db.getData();
  const index = data.items.findIndex(it => it.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });

  data.items.splice(index, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 3. MASTER DATA ENDPOINTS: CUSTOMERS
// ==========================================
app.get('/api/customers', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let filtered = data.customers;
  if (search) {
    filtered = data.customers.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (c.email && c.email.toLowerCase().includes(search)) ||
      (c.phone && c.phone.replace(/[^0-9]/g, '').includes(search.replace(/[^0-9]/g, '')))
    );
  }

  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.post('/api/customers', authenticate, (req, res) => {
  const data = db.getData();
  const { name, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required' });

  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    name,
    email,
    phone,
    address,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.customers.push(newCustomer);
  db.save();
  res.status(201).json(newCustomer);
});

app.put('/api/customers/:id', authenticate, (req, res) => {
  const data = db.getData();
  const customer = data.customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const { name, email, phone, address } = req.body;
  if (name !== undefined) customer.name = name;
  if (email !== undefined) customer.email = email;
  if (phone !== undefined) customer.phone = phone;
  if (address !== undefined) customer.address = address;
  customer.updatedAt = new Date().toISOString();

  db.save();
  res.json(customer);
});

app.delete('/api/customers/:id', authenticate, (req, res) => {
  const data = db.getData();
  const index = data.customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  data.customers.splice(index, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 4. MASTER DATA ENDPOINTS: SUPPLIERS
// ==========================================
app.get('/api/suppliers', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let filtered = data.suppliers;
  if (search) {
    filtered = data.suppliers.filter(s => 
      s.name.toLowerCase().includes(search) || 
      (s.email && s.email.toLowerCase().includes(search)) ||
      (s.phone && s.phone.includes(search))
    );
  }

  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.post('/api/suppliers', authenticate, (req, res) => {
  const data = db.getData();
  const { name, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });

  const newSupplier: Supplier = {
    id: `supp-${Date.now()}`,
    name,
    email,
    phone,
    address,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.suppliers.push(newSupplier);
  db.save();
  res.status(201).json(newSupplier);
});

app.put('/api/suppliers/:id', authenticate, (req, res) => {
  const data = db.getData();
  const supplier = data.suppliers.find(s => s.id === req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const { name, email, phone, address } = req.body;
  if (name !== undefined) supplier.name = name;
  if (email !== undefined) supplier.email = email;
  if (phone !== undefined) supplier.phone = phone;
  if (address !== undefined) supplier.address = address;
  supplier.updatedAt = new Date().toISOString();

  db.save();
  res.json(supplier);
});

app.delete('/api/suppliers/:id', authenticate, (req, res) => {
  const data = db.getData();
  const index = data.suppliers.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Supplier not found' });

  data.suppliers.splice(index, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 5. MASTER DATA ENDPOINTS: WAREHOUSES
// ==========================================
app.get('/api/warehouses', authenticate, (req, res) => {
  const data = db.getData();
  res.json(data.warehouses);
});

app.post('/api/warehouses', authenticate, (req, res) => {
  const data = db.getData();
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Warehouse name is required' });

  const newWarehouse: Warehouse = {
    id: `wh-${Date.now()}`,
    name,
    location,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.warehouses.push(newWarehouse);
  db.save();
  res.status(201).json(newWarehouse);
});

app.put('/api/warehouses/:id', authenticate, (req, res) => {
  const data = db.getData();
  const wh = data.warehouses.find(w => w.id === req.params.id);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  const { name, location } = req.body;
  if (name !== undefined) wh.name = name;
  if (location !== undefined) wh.location = location;
  wh.updatedAt = new Date().toISOString();

  db.save();
  res.json(wh);
});

app.delete('/api/warehouses/:id', authenticate, (req, res) => {
  const data = db.getData();
  const index = data.warehouses.findIndex(w => w.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Warehouse not found' });

  data.warehouses.splice(index, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 6. PURCHASE ORDER (PO) ENDPOINTS
// ==========================================
app.get('/api/purchase-orders', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const status = req.query.status as string || '';
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let filtered = data.purchaseOrders.map(p => db.resolvePO(p));

  if (status) {
    filtered = filtered.filter(p => p.status === status);
  }

  if (search) {
    filtered = filtered.filter(p => 
      p.poNumber.toLowerCase().includes(search) || 
      (p.supplierName && p.supplierName.toLowerCase().includes(search)) ||
      (p.remarks && p.remarks.toLowerCase().includes(search))
    );
  }

  // Sort descending by orderDate or poNumber
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.get('/api/purchase-orders/:id', authenticate, (req, res) => {
  const data = db.getData();
  const po = data.purchaseOrders.find(p => p.id === req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

  res.json(db.resolvePO(po));
});

app.post('/api/purchase-orders', authenticate, (req, res) => {
  const data = db.getData();
  const { supplierId, orderDate, expectedDate, remarks, items, status } = req.body;

  if (!supplierId || !orderDate || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier, Order Date, and at least one Item are required' });
  }

  const supplier = data.suppliers.find(s => s.id === supplierId);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const poNumber = db.nextSequence('PO', data.purchaseOrders.map(p => p.poNumber));
  
  let totalAmount = 0;
  const poItems: PurchaseOrderItem[] = items.map((it: any) => {
    const qty = Math.max(0, Number(it.quantity) || 0);
    const price = Math.max(0, Number(it.unitPrice) || 0);
    const itemTotal = qty * price;
    totalAmount += itemTotal;

    return {
      id: `poi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: it.itemId,
      quantity: qty,
      unitPrice: price,
      total: itemTotal
    };
  });

  const newPO: PurchaseOrder = {
    id: `po-${Date.now()}`,
    poNumber,
    supplierId,
    orderDate,
    expectedDate: expectedDate || orderDate,
    status: (status && ['Draft', 'Submitted', 'Completed'].includes(status) ? status : 'Draft') as any,
    remarks,
    totalAmount,
    items: poItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.purchaseOrders.push(newPO);
  db.save();
  res.status(201).json(db.resolvePO(newPO));
});

app.put('/api/purchase-orders/:id', authenticate, (req, res) => {
  const data = db.getData();
  const po = data.purchaseOrders.find(p => p.id === req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

  if (po.status !== 'Draft') {
    return res.status(400).json({ error: 'Only Draft Purchase Orders can be edited.' });
  }

  const { supplierId, orderDate, expectedDate, status, remarks, items } = req.body;

  if (supplierId) {
    const supplier = data.suppliers.find(s => s.id === supplierId);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    po.supplierId = supplierId;
  }

  if (orderDate) po.orderDate = orderDate;
  if (expectedDate) po.expectedDate = expectedDate;
  if (remarks !== undefined) po.remarks = remarks;
  
  if (status && ['Draft', 'Submitted', 'Completed'].includes(status)) {
    po.status = status as any;
  }

  if (items && Array.isArray(items) && items.length > 0) {
    let totalAmount = 0;
    po.items = items.map((it: any) => {
      const qty = Math.max(0, Number(it.quantity) || 0);
      const price = Math.max(0, Number(it.unitPrice) || 0);
      const itemTotal = qty * price;
      totalAmount += itemTotal;

      return {
        id: it.id || `poi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId: it.itemId,
        quantity: qty,
        unitPrice: price,
        total: itemTotal
      };
    });
    po.totalAmount = totalAmount;
  }

  po.updatedAt = new Date().toISOString();
  db.save();
  res.json(db.resolvePO(po));
});

app.post('/api/purchase-orders/:id/submit', authenticate, (req, res) => {
  const data = db.getData();
  const po = data.purchaseOrders.find(p => p.id === req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

  if (po.status !== 'Draft') {
    return res.status(400).json({ error: 'Only Draft Purchase Orders can be submitted.' });
  }

  po.status = 'Submitted';
  po.updatedAt = new Date().toISOString();
  db.save();
  res.json(db.resolvePO(po));
});

app.delete('/api/purchase-orders/:id', authenticate, (req, res) => {
  const data = db.getData();
  const index = data.purchaseOrders.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Purchase Order not found' });

  const po = data.purchaseOrders[index];
  if (po.status !== 'Draft') {
    return res.status(400).json({ error: 'Only Draft POS can be deleted.' });
  }

  data.purchaseOrders.splice(index, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 7. GOODS RECEIPT (GR) ENDPOINTS
// ==========================================
app.get('/api/goods-receipts', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let resolved = data.goodsReceipts.map(gr => db.resolveGR(gr));

  if (search) {
    resolved = resolved.filter(g => 
      g.grNumber.toLowerCase().includes(search) || 
      (g.poNumber && g.poNumber.toLowerCase().includes(search)) ||
      (g.warehouseName && g.warehouseName.toLowerCase().includes(search))
    );
  }

  resolved.sort((a,b) => b.receiptDate.localeCompare(a.receiptDate));

  const total = resolved.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = resolved.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.post('/api/goods-receipts', authenticate, (req, res) => {
  const data = db.getData();
  let { supplierId, poId, warehouseId, receiptDate, remarks, items } = req.body;

  if (poId && !supplierId) {
    const backupPo = data.purchaseOrders.find(p => p.id === poId);
    if (backupPo) {
      supplierId = backupPo.supplierId;
    }
  }

  if (!supplierId || !warehouseId || !receiptDate || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier, Warehouse, Date, and Items are required' });
  }

  const wh = data.warehouses.find(w => w.id === warehouseId);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  const grNumber = db.nextSequence('GR', data.goodsReceipts.map(g => g.grNumber));
  const affectedPoIds = new Set<string>();

  const receiptItems: GoodsReceiptItem[] = items.map((it: any) => {
    const rxQty = Math.max(0, Number(it.receivedQty) || 0);
    const itemPoId = it.sourcePoId || poId;
    
    if (itemPoId) {
      affectedPoIds.add(itemPoId);
    }

    let srcPoItem: any = null;
    let poNumber: string | undefined = undefined;
    if (itemPoId) {
      const srcPo = data.purchaseOrders.find(p => p.id === itemPoId);
      if (srcPo) {
        poNumber = srcPo.poNumber;
        srcPoItem = srcPo.items.find((pItem: any) => pItem.id === it.sourcePoItemId || pItem.itemId === it.itemId);
      }
    }

    const orderedQty = srcPoItem ? srcPoItem.quantity : rxQty;
    let previouslyReceivedQty = 0;
    if (srcPoItem) {
      previouslyReceivedQty = srcPoItem.receivedQty || 0;
    }

    return {
      id: `gri-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: it.itemId,
      receivedQty: rxQty,
      invoicedQty: 0,
      sourcePoId: itemPoId,
      sourcePoNumber: poNumber,
      sourcePoItemId: it.sourcePoItemId || (srcPoItem ? srcPoItem.id : undefined),
      orderedQty,
      previouslyReceivedQty,
      remainingQty: Math.max(0, orderedQty - previouslyReceivedQty - rxQty)
    };
  });

  const newGR: GoodsReceipt = {
    id: `gr-${Date.now()}`,
    grNumber,
    poId: poId || Array.from(affectedPoIds)[0] || '',
    supplierId,
    warehouseId,
    receiptDate,
    remarks,
    items: receiptItems,
    createdAt: new Date().toISOString()
  };

  data.goodsReceipts.push(newGR);

  receiptItems.forEach(ri => {
    db.adjustStock(
      ri.itemId,
      warehouseId,
      ri.receivedQty,
      'GR',
      grNumber,
      `Received from PO ${ri.sourcePoNumber || 'N/A'}`
    );

    if (ri.sourcePoId) {
      const srcPo = data.purchaseOrders.find(p => p.id === ri.sourcePoId);
      if (srcPo) {
        const srcPoItem = srcPo.items.find((pItem: any) => pItem.id === ri.sourcePoItemId || pItem.itemId === ri.itemId);
        if (srcPoItem) {
          srcPoItem.receivedQty = (srcPoItem.receivedQty || 0) + ri.receivedQty;
        }
      }
    }
  });

  affectedPoIds.forEach(id => {
    const srcPo = data.purchaseOrders.find(p => p.id === id);
    if (srcPo) {
      let allCompleted = true;
      let hasReceipts = false;
      srcPo.items.forEach((pItem: any) => {
        const rx = pItem.receivedQty || 0;
        if (rx > 0) hasReceipts = true;
        if (rx < pItem.quantity) {
          allCompleted = false;
        }
      });
      if (allCompleted) {
        srcPo.status = 'Completed';
      } else if (hasReceipts) {
        srcPo.status = 'Partial';
      } else {
        srcPo.status = 'Submitted';
      }
      srcPo.updatedAt = new Date().toISOString();
    }
  });

  db.save();
  res.status(201).json(db.resolveGR(newGR));
});


// ==========================================
// 8. PURCHASE INVOICE ENDPOINTS
// ==========================================
app.get('/api/purchase-invoices', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const status = req.query.status as string || '';
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let resolved = data.purchaseInvoices.map(pi => db.resolvePI(pi));

  if (status) {
    resolved = resolved.filter(i => i.status === status);
  }

  if (search) {
    resolved = resolved.filter(i => 
      i.piNumber.toLowerCase().includes(search) || 
      (i.supplierName && i.supplierName.toLowerCase().includes(search)) ||
      (i.poNumber && i.poNumber.toLowerCase().includes(search))
    );
  }

  resolved.sort((a,b) => b.invoiceDate.localeCompare(a.invoiceDate));

  const total = resolved.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = resolved.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.post('/api/purchase-invoices', authenticate, (req, res) => {
  const data = db.getData();
  const { supplierId, poId, invoiceDate, dueDate, remarks, items, status } = req.body;

  if (!supplierId || !invoiceDate || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier, Invoice Date, and Items are required' });
  }

  const supplier = data.suppliers.find(s => s.id === supplierId);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const piNumber = db.nextSequence('PI', data.purchaseInvoices.map(i => i.piNumber));

  let totalAmount = 0;
  const invoiceItems: PurchaseInvoiceItem[] = items.map((it: any) => {
    const qty = Math.max(0, Number(it.quantity) || 0);
    const price = Math.max(0, Number(it.price) || 0);
    const itTotal = qty * price;
    totalAmount += itTotal;

    // Get source GR info
    let grNumber: string | undefined = undefined;
    let rxQty = qty;
    let prevInvoiced = 0;
    if (it.sourceGrId) {
      const srcGr = data.goodsReceipts.find(g => g.id === it.sourceGrId);
      if (srcGr) {
        grNumber = srcGr.grNumber;
        const srcGrItem = srcGr.items.find((gItem: any) => gItem.id === it.sourceGrItemId || gItem.itemId === it.itemId);
        if (srcGrItem) {
          rxQty = srcGrItem.receivedQty || 0;
          prevInvoiced = srcGrItem.invoicedQty || 0;
        }
      }
    }

    return {
      id: `pii-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: it.itemId,
      quantity: qty,
      price,
      total: itTotal,
      sourceGrId: it.sourceGrId,
      sourceGrNumber: grNumber,
      sourceGrItemId: it.sourceGrItemId,
      receivedQty: rxQty,
      previouslyInvoicedQty: prevInvoiced
    };
  });

  const newPI: PurchaseInvoice = {
    id: `pi-${Date.now()}`,
    piNumber,
    supplierId,
    poId,
    invoiceDate,
    dueDate: dueDate || invoiceDate,
    status: (status || 'Draft') as any,
    remarks,
    totalAmount,
    items: invoiceItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.purchaseInvoices.push(newPI);

  invoiceItems.forEach(ri => {
    if (ri.sourceGrId) {
      const srcGr = data.goodsReceipts.find(g => g.id === ri.sourceGrId);
      if (srcGr) {
        const srcGrItem = srcGr.items.find((gItem: any) => gItem.id === ri.sourceGrItemId || gItem.itemId === ri.itemId);
        if (srcGrItem) {
          srcGrItem.invoicedQty = (srcGrItem.invoicedQty || 0) + ri.quantity;
        }
      }
    }
  });

  db.save();
  res.status(201).json(db.resolvePI(newPI));
});

app.put('/api/purchase-invoices/:id', authenticate, (req, res) => {
  const data = db.getData();
  const pi = data.purchaseInvoices.find(p => p.id === req.params.id);
  if (!pi) return res.status(404).json({ error: 'Purchase Invoice not found' });

  const { status, remarks, dueDate, invoiceDate } = req.body;

  if (status && ['Draft', 'Unpaid', 'Paid'].includes(status)) {
    pi.status = status as any;
  }
  if (remarks !== undefined) pi.remarks = remarks;
  if (dueDate) pi.dueDate = dueDate;
  if (invoiceDate) pi.invoiceDate = invoiceDate;

  pi.updatedAt = new Date().toISOString();
  db.save();
  res.json(db.resolvePI(pi));
});


// ==========================================
// 9. SALES ORDER (SO) ENDPOINTS
// ==========================================
app.get('/api/sales-orders', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const status = req.query.status as string || '';
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let filtered = data.salesOrders.map(s => db.resolveSO(s));

  if (status) {
    filtered = filtered.filter(s => s.status === status);
  }

  if (search) {
    filtered = filtered.filter(s => 
      s.soNumber.toLowerCase().includes(search) || 
      (s.customerName && s.customerName.toLowerCase().includes(search)) ||
      (s.remarks && s.remarks.toLowerCase().includes(search))
    );
  }

  filtered.sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.get('/api/sales-orders/:id', authenticate, (req, res) => {
  const data = db.getData();
  const so = data.salesOrders.find(s => s.id === req.params.id);
  if (!so) return res.status(404).json({ error: 'Sales Order not found' });

  res.json(db.resolveSO(so));
});

app.post('/api/sales-orders', authenticate, (req, res) => {
  const data = db.getData();
  const { customerId, orderDate, deliveryDate, remarks, items, status } = req.body;

  if (!customerId || !orderDate || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer, Order Date, and at least one Item are required' });
  }

  const customer = data.customers.find(c => c.id === customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const soNumber = db.nextSequence('SO', data.salesOrders.map(s => s.soNumber));

  let totalAmount = 0;
  const soItems: SalesOrderItem[] = items.map((it: any) => {
    const qty = Math.max(0, Number(it.quantity) || 0);
    const price = Math.max(0, Number(it.unitPrice) || 0);
    const itTotal = qty * price;
    totalAmount += itTotal;

    return {
      id: `soi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: it.itemId,
      quantity: qty,
      unitPrice: price,
      total: itTotal
    };
  });

  const newSO: SalesOrder = {
    id: `so-${Date.now()}`,
    soNumber,
    customerId,
    orderDate,
    deliveryDate: deliveryDate || orderDate,
    status: (status && ['Draft', 'Submitted', 'Completed'].includes(status) ? status : 'Draft') as any,
    remarks,
    totalAmount,
    items: soItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.salesOrders.push(newSO);
  db.save();
  res.status(201).json(db.resolveSO(newSO));
});

app.put('/api/sales-orders/:id', authenticate, (req, res) => {
  const data = db.getData();
  const so = data.salesOrders.find(s => s.id === req.params.id);
  if (!so) return res.status(404).json({ error: 'Sales Order not found' });

  if (so.status !== 'Draft') {
    return res.status(400).json({ error: 'Only Draft Sales Orders can be edited.' });
  }

  const { customerId, orderDate, deliveryDate, remarks, items, status } = req.body;

  if (customerId) {
    const customer = data.customers.find(c => c.id === customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    so.customerId = customerId;
  }

  if (orderDate) so.orderDate = orderDate;
  if (deliveryDate) so.deliveryDate = deliveryDate;
  if (remarks !== undefined) so.remarks = remarks;
  if (status && ['Draft', 'Submitted', 'Completed'].includes(status)) {
    so.status = status as any;
  }

  if (items && Array.isArray(items) && items.length > 0) {
    let totalAmount = 0;
    so.items = items.map((it: any) => {
      const qty = Math.max(0, Number(it.quantity) || 0);
      const price = Math.max(0, Number(it.unitPrice) || 0);
      const itTotal = qty * price;
      totalAmount += itTotal;

      return {
        id: it.id || `soi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId: it.itemId,
        quantity: qty,
        unitPrice: price,
        total: itTotal
      };
    });
    so.totalAmount = totalAmount;
  }

  so.updatedAt = new Date().toISOString();
  db.save();
  res.json(db.resolveSO(so));
});

app.post('/api/sales-orders/:id/submit', authenticate, (req, res) => {
  const data = db.getData();
  const so = data.salesOrders.find(s => s.id === req.params.id);
  if (!so) return res.status(404).json({ error: 'Sales Order not found' });

  if (so.status !== 'Draft') {
    return res.status(400).json({ error: 'Only Draft can be submitted.' });
  }

  so.status = 'Submitted';
  so.updatedAt = new Date().toISOString();
  db.save();
  res.json(db.resolveSO(so));
});

app.delete('/api/sales-orders/:id', authenticate, (req, res) => {
  const data = db.getData();
  const index = data.salesOrders.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Sales Order not found' });

  const so = data.salesOrders[index];
  if (so.status !== 'Draft') {
    return res.status(400).json({ error: 'Only Draft SOs can be deleted' });
  }

  data.salesOrders.splice(index, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 10. DELIVERY ORDER (DO) ENDPOINTS
// ==========================================
app.get('/api/delivery-orders', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let resolved = data.deliveryOrders.map(doRec => db.resolveDO(doRec));

  if (search) {
    resolved = resolved.filter(d => 
      d.doNumber.toLowerCase().includes(search) || 
      (d.soNumber && d.soNumber.toLowerCase().includes(search)) ||
      (d.warehouseName && d.warehouseName.toLowerCase().includes(search))
    );
  }

  resolved.sort((a,b) => b.deliveryDate.localeCompare(a.deliveryDate));

  const total = resolved.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = resolved.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.post('/api/delivery-orders', authenticate, (req, res) => {
  const data = db.getData();
  let { customerId, soId, warehouseId, deliveryDate, remarks, items } = req.body;

  if (soId && !customerId) {
    const backupSo = data.salesOrders.find(s => s.id === soId);
    if (backupSo) {
      customerId = backupSo.customerId;
    }
  }

  if (!customerId || !warehouseId || !deliveryDate || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer, Warehouse, Date, and Items are required' });
  }

  const wh = data.warehouses.find(w => w.id === warehouseId);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  // VALIDATION: Ensure we have enough stock across items to deliver
  for (const it of items) {
    const stock = data.warehouseStocks.find(s => s.itemId === it.itemId && s.warehouseId === warehouseId);
    const requestedQty = Math.max(0, Number(it.deliveredQty) || 0);
    const available = stock ? stock.currentQty : 0;
    if (available < requestedQty) {
      const itemNode = data.items.find(pi => pi.id === it.itemId);
      return res.status(400).json({
        error: `Insufficient stock for [${itemNode ? itemNode.name : it.itemId}] in selected warehouse. Available: ${available}, Required: ${requestedQty}`
      });
    }
  }

  const doNumber = db.nextSequence('DO', data.deliveryOrders.map(d => d.doNumber));
  const affectedSoIds = new Set<string>();

  const deliveryItems: DeliveryOrderItem[] = items.map((it: any) => {
    const delQty = Math.max(0, Number(it.deliveredQty) || 0);
    const itemSoId = it.sourceSoId || soId;

    if (itemSoId) {
      affectedSoIds.add(itemSoId);
    }

    let srcSoItem: any = null;
    let soNumber: string | undefined = undefined;
    if (itemSoId) {
      const srcSo = data.salesOrders.find(s => s.id === itemSoId);
      if (srcSo) {
        soNumber = srcSo.soNumber;
        srcSoItem = srcSo.items.find((sItem: any) => sItem.id === it.sourceSoItemId || sItem.itemId === it.itemId);
      }
    }

    const orderedQty = srcSoItem ? srcSoItem.quantity : delQty;
    let previouslyDeliveredQty = 0;
    if (srcSoItem) {
      previouslyDeliveredQty = srcSoItem.deliveredQty || 0;
    }

    return {
      id: `doi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: it.itemId,
      deliveredQty: delQty,
      invoicedQty: 0,
      sourceSoId: itemSoId,
      sourceSoNumber: soNumber,
      sourceSoItemId: it.sourceSoItemId || (srcSoItem ? srcSoItem.id : undefined),
      orderedQty,
      previouslyDeliveredQty,
      remainingQty: Math.max(0, orderedQty - previouslyDeliveredQty - delQty)
    };
  });

  const newDO: DeliveryOrder = {
    id: `do-${Date.now()}`,
    doNumber,
    soId: soId || Array.from(affectedSoIds)[0] || '',
    customerId,
    warehouseId,
    deliveryDate,
    remarks,
    items: deliveryItems,
    createdAt: new Date().toISOString()
  };

  data.deliveryOrders.push(newDO);

  deliveryItems.forEach(di => {
    db.adjustStock(
      di.itemId,
      warehouseId,
      -di.deliveredQty, // Reduce stock!
      'DO',
      doNumber,
      `Delivered for Sales Order ${di.sourceSoNumber || 'N/A'}`
    );

    if (di.sourceSoId) {
      const srcSo = data.salesOrders.find(s => s.id === di.sourceSoId);
      if (srcSo) {
        const srcSoItem = srcSo.items.find((sItem: any) => sItem.id === di.sourceSoItemId || sItem.itemId === di.itemId);
        if (srcSoItem) {
          srcSoItem.deliveredQty = (srcSoItem.deliveredQty || 0) + di.deliveredQty;
        }
      }
    }
  });

  affectedSoIds.forEach(id => {
    const srcSo = data.salesOrders.find(s => s.id === id);
    if (srcSo) {
      let allCompleted = true;
      let hasDeliveries = false;
      srcSo.items.forEach((sItem: any) => {
        const del = sItem.deliveredQty || 0;
        if (del > 0) hasDeliveries = true;
        if (del < sItem.quantity) {
          allCompleted = false;
        }
      });
      if (allCompleted) {
        srcSo.status = 'Completed';
      } else if (hasDeliveries) {
        srcSo.status = 'Partial';
      } else {
        srcSo.status = 'Submitted';
      }
      srcSo.updatedAt = new Date().toISOString();
    }
  });

  db.save();
  res.status(201).json(db.resolveDO(newDO));
});


// ==========================================
// 11. SALES INVOICE (SI) ENDPOINTS
// ==========================================
app.get('/api/sales-invoices', authenticate, (req, res) => {
  const data = db.getData();
  const search = (req.query.search as string || '').toLowerCase();
  const status = req.query.status as string || '';
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);

  let resolved = data.salesInvoices.map(si => db.resolveSI(si));

  if (status) {
    resolved = resolved.filter(i => i.status === status);
  }

  if (search) {
    resolved = resolved.filter(i => 
      i.siNumber.toLowerCase().includes(search) || 
      (i.customerName && i.customerName.toLowerCase().includes(search)) ||
      (i.soNumber && i.soNumber.toLowerCase().includes(search))
    );
  }

  resolved.sort((a,b) => b.invoiceDate.localeCompare(a.invoiceDate));

  const total = resolved.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginated = resolved.slice(startIndex, startIndex + limit);

  res.json({ data: paginated, total, page, limit, pages });
});

app.post('/api/sales-invoices', authenticate, (req, res) => {
  const data = db.getData();
  const { customerId, soId, invoiceDate, dueDate, remarks, items, status } = req.body;

  if (!customerId || !invoiceDate || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer, Invoice Date, and Items are required' });
  }

  const customer = data.customers.find(c => c.id === customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const siNumber = db.nextSequence('SI', data.salesInvoices.map(s => s.siNumber));

  let totalAmount = 0;
  const invoiceItems: SalesInvoiceItem[] = items.map((it: any) => {
    const qty = Math.max(0, Number(it.quantity) || 0);
    const price = Math.max(0, Number(it.price) || 0);
    const itTotal = qty * price;
    totalAmount += itTotal;

    // Get source DO info
    let doNumber: string | undefined = undefined;
    let delQty = qty;
    let prevInvoiced = 0;
    if (it.sourceDoId) {
      const srcDo = data.deliveryOrders.find(d => d.id === it.sourceDoId);
      if (srcDo) {
        doNumber = srcDo.doNumber;
        const srcDoItem = srcDo.items.find((dItem: any) => dItem.id === it.sourceDoItemId || dItem.itemId === it.itemId);
        if (srcDoItem) {
          delQty = srcDoItem.deliveredQty || 0;
          prevInvoiced = srcDoItem.invoicedQty || 0;
        }
      }
    }

    return {
      id: `sii-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: it.itemId,
      quantity: qty,
      price,
      total: itTotal,
      sourceDoId: it.sourceDoId,
      sourceDoNumber: doNumber,
      sourceDoItemId: it.sourceDoItemId,
      deliveredQty: delQty,
      previouslyInvoicedQty: prevInvoiced
    };
  });

  const newSI: SalesInvoice = {
    id: `si-${Date.now()}`,
    siNumber,
    customerId,
    soId,
    invoiceDate,
    dueDate: dueDate || invoiceDate,
    status: (status || 'Draft') as any,
    remarks,
    totalAmount,
    items: invoiceItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.salesInvoices.push(newSI);

  invoiceItems.forEach(ri => {
    if (ri.sourceDoId) {
      const srcDo = data.deliveryOrders.find(d => d.id === ri.sourceDoId);
      if (srcDo) {
        const srcDoItem = srcDo.items.find((dItem: any) => dItem.id === ri.sourceDoItemId || dItem.itemId === ri.itemId);
        if (srcDoItem) {
          srcDoItem.invoicedQty = (srcDoItem.invoicedQty || 0) + ri.quantity;
        }
      }
    }
  });

  db.save();
  res.status(201).json(db.resolveSI(newSI));
});

app.put('/api/sales-invoices/:id', authenticate, (req, res) => {
  const data = db.getData();
  const si = data.salesInvoices.find(s => s.id === req.params.id);
  if (!si) return res.status(404).json({ error: 'Sales Invoice not found' });

  const { status, remarks, dueDate, invoiceDate } = req.body;

  if (status && ['Draft', 'Unpaid', 'Paid'].includes(status)) {
    si.status = status as any;
  }
  if (remarks !== undefined) si.remarks = remarks;
  if (dueDate) si.dueDate = dueDate;
  if (invoiceDate) si.invoiceDate = invoiceDate;

  si.updatedAt = new Date().toISOString();
  db.save();
  res.json(db.resolveSI(si));
});


// ==========================================
// 11b. RECEIVABLE PAYMENT ENDPOINTS
// ==========================================
app.get('/api/receivable-payments', authenticate, (req, res) => {
  const data = db.getData();
  if (!data.receivablePayments) data.receivablePayments = [];
  
  // Resolve customer name and invoice number for display
  const resolved = data.receivablePayments.map(rp => {
    const cust = data.customers.find(c => c.id === rp.customerId);
    const inv = data.salesInvoices.find(si => si.id === rp.invoiceId);
    return {
      ...rp,
      customerName: cust ? cust.name : 'Unknown Customer',
      invoiceNumber: inv ? inv.siNumber : 'N/A'
    };
  });

  resolved.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  res.json({ data: resolved });
});

app.post('/api/receivable-payments', authenticate, (req, res) => {
  const data = db.getData();
  if (!data.receivablePayments) data.receivablePayments = [];
  
  const { customerId, invoiceId, paymentDate, paymentMethod, amount, remarks } = req.body;
  if (!customerId || !invoiceId || !paymentDate || !paymentMethod || !amount) {
    return res.status(400).json({ error: 'Customer, Invoice, Date, Method, and Amount are required' });
  }

  const si = data.salesInvoices.find(s => s.id === invoiceId);
  if (!si) return res.status(404).json({ error: 'Sales Invoice not found' });

  const paymentNumber = db.nextSequence('RCP', data.receivablePayments.map(p => p.paymentNumber));
  const newPayment: ReceivablePayment = {
    id: `rcp-${Date.now()}`,
    paymentNumber,
    customerId,
    invoiceId,
    paymentDate,
    paymentMethod,
    amount: Number(amount),
    remarks,
    createdAt: new Date().toISOString()
  };

  // Mark Sales Invoice as Paid
  si.status = 'Paid';
  si.updatedAt = new Date().toISOString();

  data.receivablePayments.push(newPayment);
  db.save();

  const cust = data.customers.find(c => c.id === customerId);
  res.status(201).json({
    ...newPayment,
    customerName: cust ? cust.name : 'Unknown Customer',
    invoiceNumber: si.siNumber
  });
});

app.delete('/api/receivable-payments/:id', authenticate, (req, res) => {
  const data = db.getData();
  if (!data.receivablePayments) data.receivablePayments = [];

  const idx = data.receivablePayments.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Payment record not found' });

  const p = data.receivablePayments[idx];
  
  // Revert sales invoice status to Unpaid if it remains
  const si = data.salesInvoices.find(s => s.id === p.invoiceId);
  if (si) {
    si.status = 'Unpaid';
    si.updatedAt = new Date().toISOString();
  }

  data.receivablePayments.splice(idx, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 11c. PAYABLE PAYMENT ENDPOINTS
// ==========================================
app.get('/api/payable-payments', authenticate, (req, res) => {
  const data = db.getData();
  if (!data.payablePayments) data.payablePayments = [];
  
  // Resolve supplier name and invoice number for display
  const resolved = data.payablePayments.map(pp => {
    const supp = data.suppliers.find(s => s.id === pp.supplierId);
    const inv = data.purchaseInvoices.find(pi => pi.id === pp.invoiceId);
    return {
      ...pp,
      supplierName: supp ? supp.name : 'Unknown Supplier',
      invoiceNumber: inv ? inv.piNumber : 'N/A'
    };
  });

  resolved.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  res.json({ data: resolved });
});

app.post('/api/payable-payments', authenticate, (req, res) => {
  const data = db.getData();
  if (!data.payablePayments) data.payablePayments = [];
  
  const { supplierId, invoiceId, paymentDate, paymentMethod, amount, remarks } = req.body;
  if (!supplierId || !invoiceId || !paymentDate || !paymentMethod || !amount) {
    return res.status(400).json({ error: 'Supplier, Invoice, Date, Method, and Amount are required' });
  }

  const pi = data.purchaseInvoices.find(p => p.id === invoiceId);
  if (!pi) return res.status(404).json({ error: 'Purchase Invoice not found' });

  const paymentNumber = db.nextSequence('PAY', data.payablePayments.map(p => p.paymentNumber));
  const newPayment: PayablePayment = {
    id: `pay-${Date.now()}`,
    paymentNumber,
    supplierId,
    invoiceId,
    paymentDate,
    paymentMethod,
    amount: Number(amount),
    remarks,
    createdAt: new Date().toISOString()
  };

  // Mark Purchase Invoice as Paid
  pi.status = 'Paid';
  pi.updatedAt = new Date().toISOString();

  data.payablePayments.push(newPayment);
  db.save();

  const supp = data.suppliers.find(s => s.id === supplierId);
  res.status(201).json({
    ...newPayment,
    supplierName: supp ? supp.name : 'Unknown Supplier',
    invoiceNumber: pi.piNumber
  });
});

app.delete('/api/payable-payments/:id', authenticate, (req, res) => {
  const data = db.getData();
  if (!data.payablePayments) data.payablePayments = [];

  const idx = data.payablePayments.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Payment record not found' });

  const p = data.payablePayments[idx];
  
  // Revert purchase invoice status to Unpaid if it remains
  const pi = data.purchaseInvoices.find(pi => pi.id === p.invoiceId);
  if (pi) {
    pi.status = 'Unpaid';
    pi.updatedAt = new Date().toISOString();
  }

  data.payablePayments.splice(idx, 1);
  db.save();
  res.json({ success: true });
});


// ==========================================
// 11d. SEED AUTOMATED DUMMY DATA
// ==========================================
app.post('/api/seed-dummy-data', authenticate, (req, res) => {
  const data = db.getData();

  // Reset collections
  data.items = [
    {
      id: 'item-1',
      code: 'PROD-001',
      name: 'Lithium Battery Pack',
      description: 'High energy density power cells',
      unit: 'pcs',
      defaultPrice: 350,
      defaultCost: 120,
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'item-2',
      code: 'PROD-002',
      name: 'Aluminum Heat Shield',
      description: 'High-temperature reflective insulation barrier',
      unit: 'pcs',
      defaultPrice: 110,
      defaultCost: 45,
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'item-3',
      code: 'PROD-003',
      name: 'Carbon Fiber Brackets',
      description: 'Tough lightweight structural chassis adapters',
      unit: 'pcs',
      defaultPrice: 220,
      defaultCost: 90,
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'item-4',
      code: 'PROD-004',
      name: 'Electronic Control Board',
      description: 'Central processing unit with integrated MCU',
      unit: 'pcs',
      defaultPrice: 550,
      defaultCost: 210,
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    }
  ];

  data.customers = [
    {
      id: 'cust-1',
      name: 'Zenith Global Aerospace',
      email: 'orders@zenith-aerospace.com',
      phone: '+1-415-442-9988',
      address: 'Bldg 4A, Aero Park Terminal, San Francisco, CA',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'cust-2',
      name: 'Apex Automotive Tech',
      email: 'build@apex-automotive.org',
      phone: '+1-313-556-4221',
      address: '402 Fordway Dr, Dearborn, MI',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'cust-3',
      name: 'Meridian Dynamics',
      email: 'info@meridian-dynamics.com',
      phone: '+62-811-9238-129',
      address: 'Grand Indonesia Tower, Lt 41, Jakarta',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    }
  ];

  data.suppliers = [
    {
      id: 'supp-1',
      name: 'Primax Semiconductors',
      email: 'info@primax-semi.com',
      phone: '+886-2-2733-1002',
      address: 'Hsinchu Science Park, Hsinchu, Taiwan',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'supp-2',
      name: 'Solid-Alloy Forgings',
      email: 'sales@solid-alloys.co.uk',
      phone: '+44-114-239-0012',
      address: 'Unit 7, Vulcan Road Indus, Sheffield, UK',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'supp-3',
      name: 'Apex Wholesale Logistics',
      email: 'customercare@apex-logistics.org',
      phone: '+1-800-421-9988',
      address: 'Warehouse Block B, Pier 39, Seattle, WA',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    }
  ];

  data.warehouses = [
    {
      id: 'wh-1',
      name: 'North Central Depot',
      location: 'Aisle B1-B8, Main Hall',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    },
    {
      id: 'wh-2',
      name: 'South Coastal Terminal',
      location: 'Dock Zone 4, Container Depot',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    }
  ];

  data.purchaseOrders = [
    {
      id: 'po-1',
      poNumber: 'PO-2026-0001',
      supplierId: 'supp-1',
      orderDate: '2026-05-02',
      expectedDate: '2026-05-10',
      status: 'Completed',
      remarks: 'Contract order #884',
      totalAmount: 16500,
      items: [
        {
          id: 'poi-1-1',
          itemId: 'item-4',
          quantity: 50,
          unitPrice: 210,
          total: 10500,
          receivedQty: 50
        },
        {
          id: 'poi-1-2',
          itemId: 'item-1',
          quantity: 50,
          unitPrice: 120,
          total: 6000,
          receivedQty: 50
        }
      ],
      createdAt: '2026-05-02T09:00:00.000Z',
      updatedAt: '2026-05-02T09:15:00.000Z'
    },
    {
      id: 'po-2',
      poNumber: 'PO-2026-0002',
      supplierId: 'supp-2',
      orderDate: '2026-05-15',
      expectedDate: '2026-05-22',
      status: 'Completed',
      remarks: 'Metal materials batch 2',
      totalAmount: 1350,
      items: [
        {
          id: 'poi-2-1',
          itemId: 'item-2',
          quantity: 30,
          unitPrice: 45,
          total: 1350,
          receivedQty: 30
        }
      ],
      createdAt: '2026-05-15T10:00:00.000Z',
      updatedAt: '2026-05-15T10:10:00.000Z'
    },
    {
      id: 'po-3',
      poNumber: 'PO-2026-0003',
      supplierId: 'supp-3',
      orderDate: '2026-05-28',
      expectedDate: '2026-06-05',
      status: 'Submitted',
      remarks: 'Urgent custom brackets',
      totalAmount: 900,
      items: [
        {
          id: 'poi-3-1',
          itemId: 'item-3',
          quantity: 10,
          unitPrice: 90,
          total: 900,
          receivedQty: 0
        }
      ],
      createdAt: '2026-05-28T14:00:00.000Z',
      updatedAt: '2026-05-28T14:00:00.000Z'
    }
  ];

  data.goodsReceipts = [
    {
      id: 'gr-1',
      grNumber: 'GR-2026-0001',
      poId: 'po-1',
      poNumber: 'PO-2026-0001',
      supplierId: 'supp-1',
      warehouseId: 'wh-1',
      receiptDate: '2026-05-04',
      remarks: 'All pieces verified undamaged',
      items: [
        {
          id: 'gri-1-1',
          itemId: 'item-4',
          receivedQty: 50,
          invoicedQty: 50,
          sourcePoId: 'po-1',
          sourcePoNumber: 'PO-2026-0001',
          sourcePoItemId: 'poi-1-1'
        },
        {
          id: 'gri-1-2',
          itemId: 'item-1',
          receivedQty: 50,
          invoicedQty: 50,
          sourcePoId: 'po-1',
          sourcePoNumber: 'PO-2026-0001',
          sourcePoItemId: 'poi-1-2'
        }
      ],
      createdAt: '2026-05-04T10:30:00.000Z'
    },
    {
      id: 'gr-2',
      grNumber: 'GR-2026-0002',
      poId: 'po-2',
      poNumber: 'PO-2026-0002',
      supplierId: 'supp-2',
      warehouseId: 'wh-2',
      receiptDate: '2026-05-16',
      remarks: 'Arrived early morning cargo',
      items: [
        {
          id: 'gri-2-1',
          itemId: 'item-2',
          receivedQty: 30,
          invoicedQty: 30,
          sourcePoId: 'po-2',
          sourcePoNumber: 'PO-2026-0002',
          sourcePoItemId: 'poi-2-1'
        }
      ],
      createdAt: '2026-05-16T11:00:00.000Z'
    }
  ];

  data.purchaseInvoices = [
    {
      id: 'pi-1',
      piNumber: 'PI-2026-0001',
      supplierId: 'supp-1',
      poId: 'po-1',
      poNumber: 'PO-2026-0001',
      invoiceDate: '2026-05-04',
      dueDate: '2026-06-03',
      status: 'Paid',
      remarks: 'Direct digital matching invoice',
      totalAmount: 16500,
      items: [
        {
          id: 'pii-1-1',
          itemId: 'item-4',
          quantity: 50,
          price: 210,
          total: 10500,
          sourceGrId: 'gr-1',
          sourceGrNumber: 'GR-2026-0001',
          sourceGrItemId: 'gri-1-1'
        },
        {
          id: 'pii-1-2',
          itemId: 'item-1',
          quantity: 50,
          price: 120,
          total: 6000,
          sourceGrId: 'gr-1',
          sourceGrNumber: 'GR-2026-0001',
          sourceGrItemId: 'gri-1-2'
        }
      ],
      createdAt: '2026-05-04T15:00:00.000Z',
      updatedAt: '2026-05-05T09:20:00.000Z'
    },
    {
      id: 'pi-2',
      piNumber: 'PI-2026-0002',
      supplierId: 'supp-2',
      poId: 'po-2',
      poNumber: 'PO-2026-0002',
      invoiceDate: '2026-05-17',
      dueDate: '2026-06-17',
      status: 'Unpaid',
      remarks: 'Net-30 payment program',
      totalAmount: 1350,
      items: [
        {
          id: 'pii-2-1',
          itemId: 'item-2',
          quantity: 30,
          price: 45,
          total: 1350,
          sourceGrId: 'gr-2',
          sourceGrNumber: 'GR-2026-0002',
          sourceGrItemId: 'gri-2-1'
        }
      ],
      createdAt: '2026-05-17T11:00:00.000Z',
      updatedAt: '2026-05-17T11:00:00.000Z'
    }
  ];

  data.payablePayments = [
    {
      id: 'pay-1',
      paymentNumber: 'PAY-250001',
      supplierId: 'supp-1',
      invoiceId: 'pi-1',
      paymentDate: '2026-05-05',
      paymentMethod: 'Bank Transfer',
      amount: 16500,
      remarks: 'Wire Transfer Ref Txn-829381-CB',
      createdAt: '2026-05-05T09:20:00.000Z'
    }
  ];

  data.salesOrders = [
    {
      id: 'so-1',
      soNumber: 'SO-2026-0001',
      customerId: 'cust-1',
      orderDate: '2026-05-10',
      deliveryDate: '2026-05-14',
      status: 'Completed',
      remarks: 'Deliver to Dock B',
      totalAmount: 11000,
      items: [
        {
          id: 'soi-1-1',
          itemId: 'item-4',
          quantity: 20,
          unitPrice: 550,
          total: 11000,
          deliveredQty: 20
        }
      ],
      createdAt: '2026-05-10T14:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z'
    },
    {
      id: 'so-2',
      soNumber: 'SO-2026-0002',
      customerId: 'cust-2',
      orderDate: '2026-05-20',
      deliveryDate: '2026-05-25',
      status: 'Completed',
      remarks: 'Regular schedule dispatch',
      totalAmount: 3300,
      items: [
        {
          id: 'soi-2-1',
          itemId: 'item-2',
          quantity: 30,
          unitPrice: 110,
          total: 3300,
          deliveredQty: 30
        }
      ],
      createdAt: '2026-05-20T11:00:00.000Z',
      updatedAt: '2026-05-22T09:00:00.000Z'
    }
  ];

  data.deliveryOrders = [
    {
      id: 'do-1',
      doNumber: 'DO-2026-0001',
      soId: 'so-1',
      soNumber: 'SO-2026-0001',
      customerId: 'cust-1',
      warehouseId: 'wh-1',
      deliveryDate: '2026-05-12',
      remarks: 'Shipped with logistics partner A',
      items: [
        {
          id: 'doi-1-1',
          itemId: 'item-4',
          deliveredQty: 20,
          invoicedQty: 20,
          sourceSoId: 'so-1',
          sourceSoNumber: 'SO-2026-0001',
          sourceSoItemId: 'soi-1-1'
        }
      ],
      createdAt: '2026-05-12T14:30:00.000Z'
    },
    {
      id: 'do-2',
      doNumber: 'DO-2026-0002',
      soId: 'so-2',
      soNumber: 'SO-2026-0002',
      customerId: 'cust-2',
      warehouseId: 'wh-2',
      deliveryDate: '2026-05-22',
      remarks: 'Pickup by customer fleet',
      items: [
        {
          id: 'doi-2-1',
          itemId: 'item-2',
          deliveredQty: 30,
          invoicedQty: 30,
          sourceSoId: 'so-2',
          sourceSoNumber: 'SO-2026-0002',
          sourceSoItemId: 'soi-2-1'
        }
      ],
      createdAt: '2026-05-22T10:00:00.000Z'
    }
  ];

  data.salesInvoices = [
    {
      id: 'si-1',
      siNumber: 'SI-2026-0001',
      customerId: 'cust-1',
      soId: 'so-1',
      soNumber: 'SO-2026-0001',
      invoiceDate: '2026-05-14',
      dueDate: '2026-06-14',
      status: 'Paid',
      remarks: 'Automatic ledger integration SI',
      totalAmount: 11000,
      items: [
        {
          id: 'sii-1-1',
          itemId: 'item-4',
          quantity: 20,
          price: 550,
          total: 11000,
          sourceDoId: 'do-1',
          sourceDoNumber: 'DO-2026-0001',
          sourceDoItemId: 'doi-1-1'
        }
      ],
      createdAt: '2026-05-14T11:00:00.000Z',
      updatedAt: '2026-05-15T11:00:00.000Z'
    },
    {
      id: 'si-2',
      siNumber: 'SI-2026-0002',
      customerId: 'cust-2',
      soId: 'so-2',
      soNumber: 'SO-2026-0002',
      invoiceDate: '2026-05-24',
      dueDate: '2026-06-24',
      status: 'Unpaid',
      remarks: 'Approved with direct commercial invoice layout',
      totalAmount: 3300,
      items: [
        {
          id: 'sii-2-1',
          itemId: 'item-2',
          quantity: 30,
          price: 110,
          total: 3300,
          sourceDoId: 'do-2',
          sourceDoNumber: 'DO-2026-0002',
          sourceDoItemId: 'doi-2-1'
        }
      ],
      createdAt: '2026-05-24T15:30:00.000Z',
      updatedAt: '2026-05-24T15:30:00.000Z'
    }
  ];

  data.receivablePayments = [
    {
      id: 'rcp-1',
      paymentNumber: 'RCP-250001',
      customerId: 'cust-1',
      invoiceId: 'si-1',
      paymentDate: '2026-05-15',
      paymentMethod: 'Bank Transfer',
      amount: 11000,
      remarks: 'Incoming ACH wire transfer - clearing verified',
      createdAt: '2026-05-15T11:00:00.000Z'
    }
  ];

  data.stockMovements = [
    {
      id: 'mov-1',
      date: '2026-05-04',
      type: 'GR',
      refNo: 'GR-2026-0001',
      itemId: 'item-4',
      itemCode: 'PROD-004',
      itemName: 'Electronic Control Board',
      warehouseId: 'wh-1',
      warehouseName: 'North Central Depot',
      qtyIn: 50,
      qtyOut: 0,
      balanceAfter: 50,
      remarks: 'Purchase deposit PO-2026-0001',
      createdAt: '2026-05-04T10:30:00.000Z'
    },
    {
      id: 'mov-2',
      date: '2026-05-04',
      type: 'GR',
      refNo: 'GR-2026-0001',
      itemId: 'item-1',
      itemCode: 'PROD-001',
      itemName: 'Lithium Battery Pack',
      warehouseId: 'wh-1',
      warehouseName: 'North Central Depot',
      qtyIn: 50,
      qtyOut: 0,
      balanceAfter: 50,
      remarks: 'Purchase deposit PO-2026-0001',
      createdAt: '2026-05-04T10:30:00.000Z'
    },
    {
      id: 'mov-3',
      date: '2026-05-12',
      type: 'DO',
      refNo: 'DO-2026-0001',
      itemId: 'item-4',
      itemCode: 'PROD-004',
      itemName: 'Electronic Control Board',
      warehouseId: 'wh-1',
      warehouseName: 'North Central Depot',
      qtyIn: 0,
      qtyOut: 20,
      balanceAfter: 30,
      remarks: 'Dispatch Sales DO-2026-0001',
      createdAt: '2026-05-12T14:30:00.000Z'
    },
    {
      id: 'mov-4',
      date: '2026-05-16',
      type: 'GR',
      refNo: 'GR-2026-0002',
      itemId: 'item-2',
      itemCode: 'PROD-002',
      itemName: 'Aluminum Heat Shield',
      warehouseId: 'wh-2',
      warehouseName: 'South Coastal Terminal',
      qtyIn: 30,
      qtyOut: 0,
      balanceAfter: 30,
      remarks: 'Purchase deposit PO-2026-0002',
      createdAt: '2026-05-16T11:00:00.000Z'
    },
    {
      id: 'mov-5',
      date: '2026-05-22',
      type: 'DO',
      refNo: 'DO-2026-0002',
      itemId: 'item-2',
      itemCode: 'PROD-002',
      itemName: 'Aluminum Heat Shield',
      warehouseId: 'wh-2',
      warehouseName: 'South Coastal Terminal',
      qtyIn: 0,
      qtyOut: 30,
      balanceAfter: 0,
      remarks: 'Dispatch Sales DO-2026-0002',
      createdAt: '2026-05-22T10:00:00.000Z'
    }
  ];

  data.warehouseStocks = [
    {
      id: 'wst-1',
      itemId: 'item-1',
      itemCode: 'PROD-001',
      itemName: 'Lithium Battery Pack',
      warehouseId: 'wh-1',
      warehouseName: 'North Central Depot',
      currentQty: 50,
      updatedAt: '2026-05-04T10:30:00.000Z'
    },
    {
      id: 'wst-2',
      itemId: 'item-4',
      itemCode: 'PROD-004',
      itemName: 'Electronic Control Board',
      warehouseId: 'wh-1',
      warehouseName: 'North Central Depot',
      currentQty: 30,
      updatedAt: '2026-05-12T14:30:00.000Z'
    },
    {
      id: 'wst-3',
      itemId: 'item-2',
      itemCode: 'PROD-002',
      itemName: 'Aluminum Heat Shield',
      warehouseId: 'wh-2',
      warehouseName: 'South Coastal Terminal',
      currentQty: 0,
      updatedAt: '2026-05-22T10:00:00.000Z'
    }
  ];

  db.save();
  res.json({ success: true, message: 'Dummy database seeded successfully with unified purchasing, warehousing, sales, invoicing and payments audit lines.' });
});


// ==========================================
// 12. DASHBOARD ENDPOINTS
// ==========================================
function isDateInFilter(dateStr: string, filter: string, startDateStr?: string, endDateStr?: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  
  if (isNaN(d.getTime())) return false;
  
  // Normalize date comparison by focusing on YYYY-MM-DD
  const formatYMD = (date: Date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const getDayBoundaries = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return { start, end };
  };

  switch (filter) {
    case 'Today': {
      const bounds = getDayBoundaries(now);
      return d >= bounds.start && d <= bounds.end;
    }
    case 'This Week': {
      const currentDay = now.getDay();
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDay);
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - currentDay), 23, 59, 59, 999);
      return d >= startOfWeek && d <= endOfWeek;
    }
    case 'This Month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return d >= startOfMonth && d <= endOfMonth;
    }
    case 'This Year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return d >= startOfYear && d <= endOfYear;
    }
    case 'Custom': {
      if (!startDateStr || !endDateStr) return true;
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }
    default:
      return true;
  }
}

app.get('/api/dashboard/stats', authenticate, (req, res) => {
  const data = db.getData();
  const dateFilter = (req.query.dateFilter as string || 'This Year');
  const startDateParam = req.query.startDate as string;
  const endDateParam = req.query.endDate as string;

  // 1. Total Purchases: Sum of all Paid & Unpaid Purchase Invoices (Draft is excluded)
  const totalPurchases = data.purchaseInvoices
    .filter(pi => pi.status !== 'Draft' && isDateInFilter(pi.invoiceDate, dateFilter, startDateParam, endDateParam))
    .reduce((sum, pi) => sum + pi.totalAmount, 0);

  // 2. Total Sales: Sum of all Paid & Unpaid Sales Invoices (Draft is excluded)
  const totalSales = data.salesInvoices
    .filter(si => si.status !== 'Draft' && isDateInFilter(si.invoiceDate, dateFilter, startDateParam, endDateParam))
    .reduce((sum, si) => sum + si.totalAmount, 0);

  // 3. Total Stock Items: Cumulative quantity across all warehouses
  const totalStockItems = data.warehouseStocks.reduce((sum, ws) => sum + ws.currentQty, 0);

  // 4. Low Stock Items: Warehouses/items where current Qty < 30
  const lowStockItems = data.warehouseStocks.filter(ws => ws.currentQty < 30).length;

  // Monthly Charts aggregation (last 5 months)
  // We'll aggregate from invoices
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const current_year = new Date().getFullYear();

  const purchaseMonthlyMap = new Map<string, number>();
  const salesMonthlyMap = new Map<string, number>();

  data.purchaseInvoices.forEach(pi => {
    const d = new Date(pi.invoiceDate);
    if (d.getFullYear() === current_year) {
      const mLabel = months[d.getMonth()];
      purchaseMonthlyMap.set(mLabel, (purchaseMonthlyMap.get(mLabel) || 0) + pi.totalAmount);
    }
  });

  data.salesInvoices.forEach(si => {
    const d = new Date(si.invoiceDate);
    if (d.getFullYear() === current_year) {
      const mLabel = months[d.getMonth()];
      salesMonthlyMap.set(mLabel, (salesMonthlyMap.get(mLabel) || 0) + si.totalAmount);
    }
  });

  // Generate chart list (covering last 6 months or standard range)
  const chartsData = months.map(m => {
    return {
      month: m,
      purchases: Math.round(purchaseMonthlyMap.get(m) || 0),
      sales: Math.round(salesMonthlyMap.get(m) || 0)
    };
  });

  res.json({
    totalPurchases,
    totalSales,
    totalStockItems,
    lowStockItems,
    chartsData
  });
});


// ==========================================
// 13. REPORTS ENDPOINTS
// ==========================================

// Report 1: Purchase Report
app.get('/api/reports/purchase', authenticate, (req, res) => {
  const data = db.getData();
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const supplierId = req.query.supplierId as string;

  let list = data.purchaseInvoices.map(pi => db.resolvePI(pi));

  if (supplierId) {
    list = list.filter(pi => pi.supplierId === supplierId);
  }

  if (startDate) {
    list = list.filter(pi => pi.invoiceDate >= startDate);
  }
  if (endDate) {
    list = list.filter(pi => pi.invoiceDate <= endDate);
  }

  // Calculate totals
  const totalAmount = list.reduce((sum, pi) => sum + pi.totalAmount, 0);

  // Supplier Breakdown
  const supplierBreakdownMap = new Map<string, number>();
  list.forEach(pi => {
    const name = pi.supplierName || 'Unknown';
    supplierBreakdownMap.set(name, (supplierBreakdownMap.get(name) || 0) + pi.totalAmount);
  });

  const supplierBreakdown = Array.from(supplierBreakdownMap.entries()).map(([name, amount]) => ({
    supplierName: name,
    amount
  }));

  res.json({
    totalAmount,
    supplierBreakdown,
    transactions: list
  });
});

// Report 2: Sales Report
app.get('/api/reports/sales', authenticate, (req, res) => {
  const data = db.getData();
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const customerId = req.query.customerId as string;

  let list = data.salesInvoices.map(si => db.resolveSI(si));

  if (customerId) {
    list = list.filter(si => si.customerId === customerId);
  }

  if (startDate) {
    list = list.filter(si => si.invoiceDate >= startDate);
  }
  if (endDate) {
    list = list.filter(si => si.invoiceDate <= endDate);
  }

  // Calculate totals
  const totalAmount = list.reduce((sum, si) => sum + si.totalAmount, 0);

  // Customer Breakdown
  const customerBreakdownMap = new Map<string, number>();
  list.forEach(si => {
    const name = si.customerName || 'Unknown';
    customerBreakdownMap.set(name, (customerBreakdownMap.get(name) || 0) + si.totalAmount);
  });

  const customerBreakdown = Array.from(customerBreakdownMap.entries()).map(([name, amount]) => ({
    customerName: name,
    amount
  }));

  res.json({
    totalAmount,
    customerBreakdown,
    transactions: list
  });
});

// Report 3: Stock Level Report
app.get('/api/reports/stock-level', authenticate, (req, res) => {
  const data = db.getData();
  const warehouseId = req.query.warehouseId as string;
  const itemId = req.query.itemId as string;

  let list = data.warehouseStocks.map(ws => {
    const itemNode = data.items.find(i => i.id === ws.itemId);
    const whNode = data.warehouses.find(w => w.id === ws.warehouseId);
    return {
      ...ws,
      itemCode: itemNode ? itemNode.code : 'N/A',
      itemName: itemNode ? itemNode.name : 'Unknown Item',
      unit: itemNode ? itemNode.unit : 'pcs',
      warehouseName: whNode ? whNode.name : 'Unknown Warehouse'
    };
  });

  if (warehouseId) {
    list = list.filter(ws => ws.warehouseId === warehouseId);
  }
  if (itemId) {
    list = list.filter(ws => ws.itemId === itemId);
  }

  res.json(list);
});

// Report 4: Stock Ledger Report
app.get('/api/reports/stock-ledger', authenticate, (req, res) => {
  const data = db.getData();
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const itemId = req.query.itemId as string;
  const warehouseId = req.query.warehouseId as string;

  let list = data.stockMovements.map(sm => {
    const itemNode = data.items.find(i => i.id === sm.itemId);
    const whNode = data.warehouses.find(w => w.id === sm.warehouseId);
    return {
      ...sm,
      itemCode: itemNode ? itemNode.code : 'N/A',
      itemName: itemNode ? itemNode.name : 'Unknown Item',
      warehouseName: whNode ? whNode.name : 'Unknown Warehouse'
    };
  });

  if (itemId) {
    list = list.filter(sm => sm.itemId === itemId);
  }
  if (warehouseId) {
    list = list.filter(sm => sm.warehouseId === warehouseId);
  }
  if (startDate) {
    list = list.filter(sm => sm.date >= startDate);
  }
  if (endDate) {
    list = list.filter(sm => sm.date <= endDate);
  }

  // Sort chronologically ascending
  list.sort((a,b) => a.date.localeCompare(b.date));

  res.json(list);
});

// Report 5: Current Stock per Warehouse Report Setup
app.get('/api/reports/warehouse-matrix', authenticate, (req, res) => {
  const data = db.getData();
  
  // Pivot setup: Items are rows, Warehouses are columns
  const matrix = data.items.map(it => {
    const stockRow: any = {
      id: it.id,
      itemCode: it.code,
      itemName: it.name,
      unit: it.unit,
      totalQty: 0
    };

    data.warehouses.forEach(wh => {
      const stock = data.warehouseStocks.find(s => s.itemId === it.id && s.warehouseId === wh.id);
      const qty = stock ? stock.currentQty : 0;
      stockRow[wh.id] = qty;
      stockRow.totalQty += qty;
    });

    return stockRow;
  });

  res.json({
    warehouses: data.warehouses,
    matrix
  });
});


// ==========================================
// 14. VITE AND STATIC ASSETS HANDLER
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
