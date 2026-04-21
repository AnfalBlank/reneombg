import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import AuthGuard from './components/layout/AuthGuard'
import LoginPage from './pages/auth/LoginPage'
import Dashboard from './pages/Dashboard'
import ItemsPage from './pages/master-data/ItemsPage'
import VendorsPage from './pages/master-data/VendorsPage'
import DapurPage from './pages/master-data/DapurPage'
import GudangPage from './pages/master-data/GudangPage'
import CoaPage from './pages/master-data/CoaPage'
import PurchaseOrderPage from './pages/purchase/PurchaseOrderPage'
import GoodsReceiptPage from './pages/purchase/GoodsReceiptPage'
import StockPage from './pages/inventory/StockPage'
import InternalRequestPage from './pages/supply-chain/InternalRequestPage'
import DeliveryOrderPage from './pages/supply-chain/DeliveryOrderPage'
import KitchenReceivingPage from './pages/supply-chain/KitchenReceivingPage'
import JournalPage from './pages/finance/JournalPage'
import GeneralLedgerPage from './pages/finance/GeneralLedgerPage'
import PeriodClosingPage from './pages/finance/PeriodClosingPage'
import ReportsPage from './pages/finance/ReportsPage'
import UsersPage from './pages/settings/UsersPage'

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

                        {/* Master Data */}
                        <Route path="master-data/items" element={<ItemsPage />} />
                        <Route path="master-data/vendors" element={<VendorsPage />} />
                        <Route path="master-data/dapur" element={<DapurPage />} />
                        <Route path="master-data/gudang" element={<GudangPage />} />
                        <Route path="master-data/coa" element={<CoaPage />} />

                        {/* Purchase */}
                        <Route path="purchase/po" element={<PurchaseOrderPage />} />
                        <Route path="purchase/receiving" element={<GoodsReceiptPage />} />

                        {/* Inventory */}
                        <Route path="inventory/stock" element={<StockPage />} />

                        {/* Internal Supply Chain */}
                        <Route path="supply-chain/requests" element={<InternalRequestPage />} />
                        <Route path="supply-chain/delivery-orders" element={<DeliveryOrderPage />} />
                        <Route path="supply-chain/kitchen-receiving" element={<KitchenReceivingPage />} />

                        {/* Finance / Pembukuan */}
                        <Route path="finance/journal" element={<JournalPage />} />
                        <Route path="finance/general-ledger" element={<GeneralLedgerPage />} />
                        <Route path="finance/period-closing" element={<PeriodClosingPage />} />
                        <Route path="finance/reports" element={<ReportsPage />} />

                        {/* Settings */}
                        <Route path="settings/users" element={<UsersPage />} />
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
