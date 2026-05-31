/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import {
  Item,
  Customer,
  Supplier,
  Warehouse,
  PurchaseOrder,
  GoodsReceipt,
  PurchaseInvoice,
  SalesOrder,
  DeliveryOrder,
  SalesInvoice,
  StockMovement,
  WarehouseStock,
  ReceivablePayment,
  PayablePayment
} from '../types';

interface DBData {
  items: Item[];
  customers: Customer[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  purchaseInvoices: PurchaseInvoice[];
  salesOrders: SalesOrder[];
  deliveryOrders: DeliveryOrder[];
  salesInvoices: SalesInvoice[];
  stockMovements: StockMovement[];
  warehouseStocks: WarehouseStock[];
  receivablePayments?: ReceivablePayment[];
  payablePayments?: PayablePayment[];
}

const DB_FILE_PATH = path.join(process.cwd(), 'database.json');

const INITIAL_DATA: DBData = {
  items: [],
  customers: [],
  suppliers: [],
  warehouses: [],
  purchaseOrders: [],
  goodsReceipts: [],
  purchaseInvoices: [],
  salesOrders: [],
  deliveryOrders: [],
  salesInvoices: [],
  stockMovements: [],
  warehouseStocks: [],
  receivablePayments: [],
  payablePayments: []
};

// Generates some initial transaction history so that reports have stunning metrics
function seedHistoricalData(db: DBData) {
  db.items = [
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

  db.customers = [
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

  db.suppliers = [
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

  db.warehouses = [
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

  db.purchaseOrders = [
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

  db.goodsReceipts = [
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

  db.purchaseInvoices = [
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

  db.payablePayments = [
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

  db.salesOrders = [
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

  db.deliveryOrders = [
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

  db.salesInvoices = [
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

  db.receivablePayments = [
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

  db.stockMovements = [
    {
      id: 'mov-1',
      date: '2026-05-04',
      type: 'GR',
      refNo: 'GR-2026-0001',
      itemId: 'item-4',
      itemName: 'Electronic Control Board',
      itemCode: 'PROD-004',
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
      itemName: 'Lithium Battery Pack',
      itemCode: 'PROD-001',
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
      itemName: 'Electronic Control Board',
      itemCode: 'PROD-004',
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
      itemName: 'Aluminum Heat Shield',
      itemCode: 'PROD-002',
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
      itemName: 'Aluminum Heat Shield',
      itemCode: 'PROD-002',
      warehouseId: 'wh-2',
      warehouseName: 'South Coastal Terminal',
      qtyIn: 0,
      qtyOut: 30,
      balanceAfter: 0,
      remarks: 'Dispatch Sales DO-2026-0002',
      createdAt: '2026-05-22T10:00:00.000Z'
    }
  ];

  db.warehouseStocks = [
    {
      id: 'wst-1',
      itemId: 'item-1',
      itemName: 'Lithium Battery Pack',
      itemCode: 'PROD-001',
      warehouseId: 'wh-1',
      warehouseName: 'North Central Depot',
      currentQty: 50,
      updatedAt: '2026-05-04T10:30:00.000Z'
    },
    {
      id: 'wst-2',
      itemId: 'item-4',
      itemName: 'Electronic Control Board',
      itemCode: 'PROD-004',
      warehouseId: 'wh-1',
      warehouseName: 'North Central Depot',
      currentQty: 30,
      updatedAt: '2026-05-12T14:30:00.000Z'
    },
    {
      id: 'wst-3',
      itemId: 'item-2',
      itemName: 'Aluminum Heat Shield',
      itemCode: 'PROD-002',
      warehouseId: 'wh-2',
      warehouseName: 'South Coastal Terminal',
      currentQty: 0,
      updatedAt: '2026-05-22T10:00:00.000Z'
    }
  ];
}

const KEYS: (keyof DBData)[] = [
  'items', 'customers', 'suppliers', 'warehouses', 'purchaseOrders',
  'goodsReceipts', 'purchaseInvoices', 'salesOrders', 'deliveryOrders',
  'salesInvoices', 'stockMovements', 'warehouseStocks', 'receivablePayments', 'payablePayments'
];

let firebaseDb: any = null;
try {
  let config: any = null;
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  } else if (process.env.FIREBASE_PROJECT_ID) {
    config = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    };
  }

  if (config) {
    const app = initializeApp(config);
    firebaseDb = getFirestore(app, config.firestoreDatabaseId);
    console.log('Firebase Firestore initialized successfully in dbStore!');
  }
} catch (err) {
  console.error('Failed to initialize Firebase Firestore:', err);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class Database {
  private data: DBData = { ...INITIAL_DATA };
  private lastDataCached: DBData = { ...INITIAL_DATA };

  constructor() {
    this.load();
    this.loadFromFirestore();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Fallback in case arrays get corrupted
        this.ensureArrayStructures();
      } else {
        console.log('Database file does not exist. Initializing seed data...');
        this.data = {
          items: [ ...INITIAL_DATA.items ],
          customers: [ ...INITIAL_DATA.customers ],
          suppliers: [ ...INITIAL_DATA.suppliers ],
          warehouses: [ ...INITIAL_DATA.warehouses ],
          purchaseOrders: [],
          goodsReceipts: [],
          purchaseInvoices: [],
          salesOrders: [],
          deliveryOrders: [],
          salesInvoices: [],
          stockMovements: [],
          warehouseStocks: []
        };
        seedHistoricalData(this.data);
        this.saveLocalBackup();
      }
      this.lastDataCached = JSON.parse(JSON.stringify(this.data));
    } catch (error) {
      console.error('Error loading database:', error);
      this.data = { ...INITIAL_DATA };
    }
  }

  private async loadFromFirestore() {
    if (!firebaseDb) {
      console.log('Firebase is not initialized. Operating offline.');
      return;
    }
    try {
      console.log('Synchronizing with live Firestore database...');
      let databaseIsEmpty = true;

      const promises = KEYS.map(async (key) => {
        try {
          const colRef = collection(firebaseDb, key);
          const snapshot = await getDocs(colRef);
          const list: any[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          if (list.length > 0) {
            databaseIsEmpty = false;
          }
          return { key, list };
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, key);
          throw err;
        }
      });

      const results = await Promise.all(promises);

      if (databaseIsEmpty) {
        console.log('Firestore is empty. Provisioning dummy seed data to clean cloud DB...');
        await this.uploadAllToFirestore();
      } else {
        results.forEach(({ key, list }) => {
          (this.data as any)[key] = list;
        });
        console.log('Live Firestore database loaded successfully.');
      }

      this.lastDataCached = JSON.parse(JSON.stringify(this.data));
      this.saveLocalBackup();
    } catch (err) {
      console.error('Error syncing data from Firestore:', err);
    }
  }

  private async uploadAllToFirestore() {
    if (!firebaseDb) return;
    try {
      const promises: Promise<void>[] = [];
      KEYS.forEach((key) => {
        const list = (this.data as any)[key] || [];
        list.forEach((item: any) => {
          if (item && item.id) {
            const docRef = doc(firebaseDb, key, item.id);
            promises.push(
              setDoc(docRef, item).catch(err => {
                handleFirestoreError(err, OperationType.CREATE, `${key}/${item.id}`);
                throw err;
              })
            );
          }
        });
      });
      if (promises.length > 0) {
        await Promise.all(promises);
        console.log('Seeded data loaded into cloud Firestore.');
      }
    } catch (err) {
      console.error('Failed to upload seed data to Firestore:', err);
    }
  }

  private async syncChangesToFirestore() {
    if (!firebaseDb) return;
    try {
      const promises: Promise<void>[] = [];

      KEYS.forEach((key) => {
        const currentList = (this.data as any)[key] || [];
        const cachedList = (this.lastDataCached as any)[key] || [];

        const currentMap = new Map<string, any>();
        currentList.forEach((item: any) => {
          if (item && item.id) currentMap.set(item.id, item);
        });

        const cachedMap = new Map<string, any>();
        cachedList.forEach((item: any) => {
          if (item && item.id) cachedMap.set(item.id, item);
        });

        // 1. Upload new or modified docs
        currentList.forEach((item: any) => {
          if (!item || !item.id) return;
          const cachedItem = cachedMap.get(item.id);
          if (!cachedItem || JSON.stringify(item) !== JSON.stringify(cachedItem)) {
            const docRef = doc(firebaseDb, key, item.id);
            const isUpdate = !!cachedItem;
            promises.push(
              setDoc(docRef, item).catch(err => {
                handleFirestoreError(err, isUpdate ? OperationType.UPDATE : OperationType.CREATE, `${key}/${item.id}`);
                throw err;
              })
            );
          }
        });

        // 2. Delete removed docs
        cachedList.forEach((item: any) => {
          if (!item || !item.id) return;
          if (!currentMap.has(item.id)) {
            const docRef = doc(firebaseDb, key, item.id);
            promises.push(
              deleteDoc(docRef).catch(err => {
                handleFirestoreError(err, OperationType.DELETE, `${key}/${item.id}`);
                throw err;
              })
            );
          }
        });
      });

      if (promises.length > 0) {
        console.log(`Syncing ${promises.length} changes to Firestore...`);
        await Promise.all(promises);
        console.log('Firestore sync complete.');
      }

      this.lastDataCached = JSON.parse(JSON.stringify(this.data));
    } catch (err) {
      console.error('Error syncing changes to Firestore:', err);
    }
  }

  private ensureArrayStructures() {
    const keys: (keyof DBData)[] = [
      'items', 'customers', 'suppliers', 'warehouses', 'purchaseOrders',
      'goodsReceipts', 'purchaseInvoices', 'salesOrders', 'deliveryOrders',
      'salesInvoices', 'stockMovements', 'warehouseStocks', 'receivablePayments', 'payablePayments'
    ];
    keys.forEach(k => {
      if (!Array.isArray(this.data[k])) {
        (this.data as any)[k] = [];
      }
    });
  }

  private saveLocalBackup() {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Local backup write failed:', error);
    }
  }

  public save() {
    try {
      this.ensureArrayStructures();
      this.saveLocalBackup();
      this.syncChangesToFirestore();
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  public getData(): DBData {
    return this.data;
  }

  // --- Helpers for Autocomplete/Resolving references ---
  public resolvePO(po: PurchaseOrder): PurchaseOrder {
    const supp = this.data.suppliers.find(s => s.id === po.supplierId);
    const resolvedItems = po.items.map(it => {
      const parentItem = this.data.items.find(pi => pi.id === it.itemId);
      return {
        ...it,
        itemName: parentItem ? parentItem.name : 'Unknown Item',
        itemCode: parentItem ? parentItem.code : 'N/A'
      };
    });
    return {
      ...po,
      supplierName: supp ? supp.name : 'Unknown Supplier',
      items: resolvedItems
    };
  }

  public resolveSO(so: SalesOrder): SalesOrder {
    const cust = this.data.customers.find(c => c.id === so.customerId);
    const resolvedItems = so.items.map(it => {
      const parentItem = this.data.items.find(pi => pi.id === it.itemId);
      return {
        ...it,
        itemName: parentItem ? parentItem.name : 'Unknown Item',
        itemCode: parentItem ? parentItem.code : 'N/A'
      };
    });
    return {
      ...so,
      customerName: cust ? cust.name : 'Unknown Customer',
      items: resolvedItems
    };
  }

  public resolveGR(gr: GoodsReceipt): GoodsReceipt {
    const supp = gr.supplierId ? this.data.suppliers.find(s => s.id === gr.supplierId) : null;
    const po = gr.poId ? this.data.purchaseOrders.find(p => p.id === gr.poId) : null;
    const wh = this.data.warehouses.find(w => w.id === gr.warehouseId);
    const resolvedItems = gr.items.map(it => {
      const parentItem = this.data.items.find(pi => pi.id === it.itemId);
      const sourcePo = it.sourcePoId ? this.data.purchaseOrders.find(p => p.id === it.sourcePoId) : null;
      return {
        ...it,
        itemName: parentItem ? parentItem.name : 'Unknown Item',
        itemCode: parentItem ? parentItem.code : 'N/A',
        sourcePoNumber: it.sourcePoNumber || (sourcePo ? sourcePo.poNumber : 'N/A')
      };
    });

    const poNumbersSet = new Set<string>();
    resolvedItems.forEach(it => { if (it.sourcePoNumber && it.sourcePoNumber !== 'N/A') poNumbersSet.add(it.sourcePoNumber); });
    if (gr.poNumber && poNumbersSet.size === 0) poNumbersSet.add(gr.poNumber);
    if (po && poNumbersSet.size === 0) poNumbersSet.add(po.poNumber);
    const combinedPoNumbers = Array.from(poNumbersSet).join(', ');

    return {
      ...gr,
      poNumber: combinedPoNumbers || 'Unknown PO',
      supplierName: supp ? supp.name : (po ? this.data.suppliers.find(s => s.id === po.supplierId)?.name : 'Unknown Supplier'),
      warehouseName: wh ? wh.name : 'Unknown Warehouse',
      items: resolvedItems
    } as any;
  }

  public resolveDO(doRec: DeliveryOrder): DeliveryOrder {
    const cust = doRec.customerId ? this.data.customers.find(c => c.id === doRec.customerId) : null;
    const so = doRec.soId ? this.data.salesOrders.find(s => s.id === doRec.soId) : null;
    const wh = this.data.warehouses.find(w => w.id === doRec.warehouseId);
    const resolvedItems = doRec.items.map(it => {
      const parentItem = this.data.items.find(pi => pi.id === it.itemId);
      const sourceSo = it.sourceSoId ? this.data.salesOrders.find(s => s.id === it.sourceSoId) : null;
      return {
        ...it,
        itemName: parentItem ? parentItem.name : 'Unknown Item',
        itemCode: parentItem ? parentItem.code : 'N/A',
        sourceSoNumber: it.sourceSoNumber || (sourceSo ? sourceSo.soNumber : 'N/A')
      };
    });

    const soNumbersSet = new Set<string>();
    resolvedItems.forEach(it => { if (it.sourceSoNumber && it.sourceSoNumber !== 'N/A') soNumbersSet.add(it.sourceSoNumber); });
    if (doRec.soNumber && soNumbersSet.size === 0) soNumbersSet.add(doRec.soNumber);
    if (so && soNumbersSet.size === 0) soNumbersSet.add(so.soNumber);
    const combinedSoNumbers = Array.from(soNumbersSet).join(', ');

    return {
      ...doRec,
      soNumber: combinedSoNumbers || 'Unknown SO',
      customerName: cust ? cust.name : (so ? this.data.customers.find(c => c.id === so.customerId)?.name : 'Unknown Customer'),
      warehouseName: wh ? wh.name : 'Unknown Warehouse',
      items: resolvedItems
    } as any;
  }

  public resolvePI(pi: PurchaseInvoice): PurchaseInvoice {
    const supp = this.data.suppliers.find(s => s.id === pi.supplierId);
    const resolvedItems = pi.items.map(it => {
      const parentItem = this.data.items.find(i => i.id === it.itemId);
      const sourceGr = it.sourceGrId ? this.data.goodsReceipts.find(g => g.id === it.sourceGrId) : null;
      return {
        ...it,
        itemName: parentItem ? parentItem.name : 'Unknown Item',
        itemCode: parentItem ? parentItem.code : 'N/A',
        sourceGrNumber: it.sourceGrNumber || (sourceGr ? sourceGr.grNumber : 'N/A')
      };
    });

    const grNumbersSet = new Set<string>();
    resolvedItems.forEach(it => { if (it.sourceGrNumber && it.sourceGrNumber !== 'N/A') grNumbersSet.add(it.sourceGrNumber); });
    if (pi.poNumber && grNumbersSet.size === 0) grNumbersSet.add(pi.poNumber);
    const combinedGrNumbers = Array.from(grNumbersSet).join(', ');

    return {
      ...pi,
      supplierName: supp ? supp.name : 'Unknown Supplier',
      poNumber: combinedGrNumbers || undefined,
      items: resolvedItems
    } as any;
  }

  public resolveSI(si: SalesInvoice): SalesInvoice {
    const cust = this.data.customers.find(c => c.id === si.customerId);
    const resolvedItems = si.items.map(it => {
      const parentItem = this.data.items.find(i => i.id === it.itemId);
      const sourceDo = it.sourceDoId ? this.data.deliveryOrders.find(d => d.id === it.sourceDoId) : null;
      return {
        ...it,
        itemName: parentItem ? parentItem.name : 'Unknown Item',
        itemCode: parentItem ? parentItem.code : 'N/A',
        sourceDoNumber: it.sourceDoNumber || (sourceDo ? sourceDo.doNumber : 'N/A')
      };
    });

    const doNumbersSet = new Set<string>();
    resolvedItems.forEach(it => { if (it.sourceDoNumber && it.sourceDoNumber !== 'N/A') doNumbersSet.add(it.sourceDoNumber); });
    if (si.soNumber && doNumbersSet.size === 0) doNumbersSet.add(si.soNumber);
    const combinedDoNumbers = Array.from(doNumbersSet).join(', ');

    return {
      ...si,
      customerName: cust ? cust.name : 'Unknown Customer',
      soNumber: combinedDoNumbers || undefined,
      items: resolvedItems
    } as any;
  }

  // --- Auto increments ---
  public nextSequence(prefix: string, list: string[]): string {
    let max = 0;
    list.forEach(item => {
      const parts = item.split('-');
      const last = parts[parts.length - 1];
      const val = parseInt(last, 10);
      if (!isNaN(val) && val > max) {
        max = val;
      }
    });
    const nextVal = (max + 1).toString().padStart(4, '0');
    return `${prefix}-${new Date().getFullYear()}-${nextVal}`;
  }

  // --- Transactions / Inventory ledger logic ---
  public adjustStock(itemId: string, warehouseId: string, qtyDelta: number, trxType: 'GR' | 'DO' | 'Initial', refNo: string, remarks?: string) {
    let ws = this.data.warehouseStocks.find(s => s.itemId === itemId && s.warehouseId === warehouseId);
    if (!ws) {
      ws = {
        id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId,
        warehouseId,
        currentQty: 0,
        updatedAt: new Date().toISOString()
      };
      this.data.warehouseStocks.push(ws);
    }
    
    const balanceBefore = ws.currentQty;
    ws.currentQty += qtyDelta;
    ws.updatedAt = new Date().toISOString();

    const qtyIn = qtyDelta > 0 ? qtyDelta : 0;
    const qtyOut = qtyDelta < 0 ? Math.abs(qtyDelta) : 0;

    const sm: StockMovement = {
      id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: new Date().toISOString(),
      type: trxType,
      refNo,
      itemId,
      warehouseId,
      qtyIn,
      qtyOut,
      balanceAfter: ws.currentQty,
      remarks: remarks || `${trxType} Stock update`,
      createdAt: new Date().toISOString()
    };
    this.data.stockMovements.push(sm);
  }
}

export const db = new Database();
export default db;
