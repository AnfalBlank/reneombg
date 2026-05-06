import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import AuthGuard from './components/layout/AuthGuard'
import LoginPage from './pages/auth/LoginPage'
import Dashboard from './pages/Dashboard'
import ItemsPage from './pages/master-data/ItemsPage'
import VendorsPage from './pages/master-data/VendorsPage'
import DapurPage from './pages/master-data/DapurPage'
import GudangPage from './pages/master-data/GudangPage'
import RecipesPage from './pages/master-data/RecipesPage'
import PurchaseOrderPage from './pages/purchase/PurchaseOrderPage'
import GoodsReceiptPage from './pages/purchase/GoodsReceiptPage'
import StockPage from './pages/inventory/StockPage'
import StockOpnamePage from './pages/inventory/StockOpnamePage'
import ReturnItemsPage from './pages/inventory/ReturnItemsPage'
import InternalRequestPage from './pages/supply-chain/InternalRequestPage'
import DeliveryOrderPage from './pages/supply-chain/DeliveryOrderPage'
import KitchenReceivingPage from './pages/supply-chain/KitchenReceivingPage'
import ConsumptionPage from './pages/supply-chain/ConsumptionPage'
import DOPrintPage from './pages/supply-chain/DOPrintPage'
import ReportsPage from './pages/finance/ReportsPage'
import FinanceDashboard from './pages/finance/FinanceDashboard'
import ArusKasPage from './pages/finance/ArusKasPage'
import InvoicePage from './pages/finance/InvoicePage'
import BudgetPage from './pages/finance/BudgetPage'
import AnalysisPage from './pages/finance/AnalysisPage'
import ExpensePage from './pages/finance/ExpensePage'
import UsersPage from './pages/settings/UsersPage'
import ProfilePage from './pages/settings/ProfilePage'
import ApprovalPage from './pages/approval/ApprovalPage'
import AuditLogPage from './pages/settings/AuditLogPage'
import AdminPanelPage from './pages/settings/AdminPanelPage'
import OperationalReportsPage from './pages/reports/OperationalReportsPage'
import PriceListPage from './pages/master-data/PriceListPage'
import PriceListViewPage from './pages/supply-chain/PriceListViewPage'
import VendorInvoicePage from './pages/finance/VendorInvoicePage'
import BudgetLogPage from './pages/finance/BudgetLogPage'
import TagihanDapurPage from './pages/finance/TagihanDapurPage'
import KitchenBillingPage from './pages/finance/KitchenBillingPage'
import ExecutiveDashboard from './pages/ExecutiveDashboard'

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Auth Route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Routes */}
                <Route element={<AuthGuard />}>
                    <Route path="/" element={<MainLayout />}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="executive" element={<ExecutiveDashboard />} />
                        <Route path="approvals" element={<ApprovalPage />} />

                        {/* Master Data */}
                        <Route path="master-data/items" element={<ItemsPage />} />
                        <Route path="master-data/vendors" element={<VendorsPage />} />
                        <Route path="master-data/dapur" element={<DapurPage />} />
                        <Route path="master-data/gudang" element={<GudangPage />} />
                        <Route path="master-data/recipes" element={<RecipesPage />} />
                        <Route path="master-data/price-list" element={<PriceListPage />} />

                        {/* Purchase */}
                        <Route path="purchase/po" element={<PurchaseOrderPage />} />
                        <Route path="purchase/receiving" element={<GoodsReceiptPage />} />

                        {/* Inventory */}
                        <Route path="inventory/stock" element={<StockPage />} />
                        <Route path="inventory/opname" element={<StockOpnamePage />} />
                        <Route path="inventory/returns" element={<ReturnItemsPage />} />

                        {/* Internal Supply Chain */}
                        <Route path="supply-chain/requests" element={<InternalRequestPage />} />
                        <Route path="supply-chain/delivery-orders" element={<DeliveryOrderPage />} />
                        <Route path="supply-chain/delivery-orders/:id/print" element={<DOPrintPage />} />
                        <Route path="supply-chain/kitchen-receiving" element={<KitchenReceivingPage />} />
                        <Route path="supply-chain/consumption" element={<ConsumptionPage />} />
                        <Route path="supply-chain/price-list" element={<PriceListViewPage />} />

                        {/* Legacy redirects */}
                        <Route path="finance/journal" element={<Navigate to="/finance/reports" replace />} />
                        <Route path="finance/general-ledger" element={<Navigate to="/finance/reports" replace />} />
                        <Route path="finance/period-closing" element={<Navigate to="/finance/reports" replace />} />
                        <Route path="accounting/journal" element={<Navigate to="/finance/reports" replace />} />
                        <Route path="accounting/general-ledger" element={<Navigate to="/finance/reports" replace />} />
                        <Route path="accounting/period-closing" element={<Navigate to="/finance/reports" replace />} />

                        {/* Finance */}
                        <Route path="finance/dashboard" element={<FinanceDashboard />} />
                        <Route path="finance/reports" element={<ReportsPage />} />
                        <Route path="finance/cash-flow" element={<ArusKasPage />} />
                        <Route path="finance/cashflow" element={<ArusKasPage />} />
                        <Route path="finance/invoices" element={<InvoicePage />} />
                        <Route path="finance/budget" element={<BudgetPage />} />
                        <Route path="finance/analysis" element={<AnalysisPage />} />
                        <Route path="finance/expenses" element={<ExpensePage />} />
                        <Route path="finance/vendor-invoices" element={<VendorInvoicePage />} />
                        <Route path="finance/budget-log" element={<BudgetLogPage />} />
                        <Route path="finance/tagihan-dapur" element={<TagihanDapurPage />} />
                        <Route path="finance/kitchen-billing" element={<KitchenBillingPage />} />

                        {/* Laporan Operasional */}
                        <Route path="reports" element={<OperationalReportsPage />} />

                        {/* Settings */}
                        <Route path="settings/users" element={<UsersPage />} />
                        <Route path="settings/profile" element={<ProfilePage />} />
                        <Route path="settings/audit-log" element={<AuditLogPage />} />
                        <Route path="settings/admin" element={<AdminPanelPage />} />
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
