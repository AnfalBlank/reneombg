import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiResponse, Item, Vendor, Dapur, Coa } from '../lib/api';

// ─── Dashboard ───────────────────────────────────────────────────────────────
export function useDashboardSummary(startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const qs = params.toString() ? '?' + params.toString() : ''
    return useQuery({
        queryKey: ['dashboard-summary', startDate, endDate],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/dashboard-summary${qs}`),
    });
}

// ─── Items ───────────────────────────────────────────────────────────────────
export function useItems() {
    return useQuery({
        queryKey: ['items'],
        queryFn: () => api.get<ApiResponse<Item[]>>('/items'),
    });
}

export function useCreateItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newItem: Partial<Item>) => api.post<ApiResponse<Item>>('/items', newItem),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
    });
}

export function useUpdateItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Item> }) => api.patch<ApiResponse<Item>>(`/items/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
    });
}

export function useDeleteItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.delete<ApiResponse<any>>(`/items/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
    });
}

// ─── Vendors ──────────────────────────────────────────────────────────────────
export function useVendors() {
    return useQuery({
        queryKey: ['vendors'],
        queryFn: () => api.get<ApiResponse<Vendor[]>>('/vendors'),
    });
}

export function useCreateVendor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newVendor: Partial<Vendor>) => api.post<ApiResponse<Vendor>>('/vendors', newVendor),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    });
}

export function useUpdateVendor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Vendor> }) => api.patch<ApiResponse<Vendor>>(`/vendors/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    });
}

export function useDeleteVendor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.delete<ApiResponse<any>>(`/vendors/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    });
}

// ─── Dapur & Gudang ──────────────────────────────────────────────────────────
export function useDapur() {
    return useQuery({
        queryKey: ['master', 'dapur'],
        queryFn: () => api.get<ApiResponse<Dapur[]>>('/master/dapur'),
    });
}

export function useGudang() {
    return useQuery({
        queryKey: ['master', 'gudang'],
        queryFn: () => api.get<ApiResponse<any[]>>('/master/gudang'),
    });
}

// -- Generic CRUD mutations for Master Data --
export function useCreateMaster(entity: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.post<ApiResponse<any>>(`/master/${entity}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', entity] }),
    });
}

export function useUpdateMaster(entity: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<ApiResponse<any>>(`/master/${entity}/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', entity] }),
    });
}

export function useDeleteMaster(entity: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.delete<ApiResponse<any>>(`/master/${entity}/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', entity] }),
    });
}

// ─── Finance ──────────────────────────────────────────────────────────────────
export function useCoa() {
    return useQuery({
        queryKey: ['master', 'coa'],
        queryFn: () => api.get<ApiResponse<Coa[]>>('/master/coa'),
    });
}

export function useJournalEntries(startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: ['journals', startDate, endDate],
        queryFn: () => api.get<ApiResponse<any[]>>(`/finance/journal?${new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' })}`),
    });
}

// ─── Purchase (Simplified) ──────────────────────────────────────────────────
export function usePurchaseOrders() {
    return useQuery({
        queryKey: ['purchase', 'orders'],
        queryFn: () => api.get<ApiResponse<any[]>>('/purchase/orders'),
    });
}

export function useCreatePurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newPO: any) => api.post<ApiResponse<any>>('/purchase/orders', newPO),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase', 'orders'] }),
    });
}

export function useReceivePurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.post<ApiResponse<any>>(`/purchase/orders/${id}/receive`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase', 'orders'] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['journals'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
        },
    });
}

export function useUpdatePurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<ApiResponse<any>>(`/purchase/orders/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase', 'orders'] }),
    });
}

// ─── Inventory ───────────────────────────────────────────────────────────────
export function useStock() {
    return useQuery({
        queryKey: ['inventory', 'stock'],
        queryFn: () => api.get<ApiResponse<any[]>>('/inventory/stock'),
    });
}

// ─── Supply Chain ────────────────────────────────────────────────────────────
export function useInternalRequests() {
    return useQuery({
        queryKey: ['supply-chain', 'requests'],
        queryFn: () => api.get<ApiResponse<any[]>>('/supply-chain/requests'),
    });
}

export function useCreateInternalRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.post<ApiResponse<any>>('/supply-chain/requests', data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supply-chain', 'requests'] }),
    });
}

export function useApproveInternalRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.patch<ApiResponse<any>>(`/supply-chain/requests/${id}/approve`, {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supply-chain', 'requests'] }),
    });
}

export function useUpdateInternalRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<ApiResponse<any>>(`/supply-chain/requests/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supply-chain', 'requests'] }),
    });
}

export function useDeliveryOrders() {
    return useQuery({
        queryKey: ['supply-chain', 'delivery-orders'],
        queryFn: () => api.get<ApiResponse<any[]>>('/supply-chain/delivery-orders'),
    });
}

export function useCreateDeliveryOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.post<ApiResponse<any>>('/supply-chain/delivery-orders', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supply-chain', 'delivery-orders'] });
            queryClient.invalidateQueries({ queryKey: ['supply-chain', 'requests'] });
        },
    });
}

export function useUpdateDeliveryOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<ApiResponse<any>>(`/supply-chain/delivery-orders/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supply-chain', 'delivery-orders'] }),
    });
}

export function useKitchenReceivings() {
    return useQuery({
        queryKey: ['supply-chain', 'kitchen-receiving'],
        queryFn: () => api.get<ApiResponse<any[]>>('/supply-chain/kitchen-receiving'),
    });
}

export function useConfirmKitchenReceiving() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ doId, data }: { doId: string; data: any }) => api.post<ApiResponse<any>>(`/supply-chain/kitchen-receiving/${doId}/confirm`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supply-chain', 'kitchen-receiving'] });
            queryClient.invalidateQueries({ queryKey: ['supply-chain', 'delivery-orders'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
        },
    });
}

export function useGoodsReceipts() {
    return useQuery({
        queryKey: ['purchase', 'receipts'],
        queryFn: () => api.get<ApiResponse<any[]>>('/purchase/receipts'),
    });
}

export function useConfirmDeliveryOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.patch<ApiResponse<any>>(`/supply-chain/delivery-orders/${id}/confirm`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supply-chain', 'delivery-orders'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
            queryClient.invalidateQueries({ queryKey: ['journals'] });
        },
    });
}

// ─── Finance ──────────────────────────────────────────────────────────────────
export function usePeriods() {
    return useQuery({
        queryKey: ['finance', 'periods'],
        queryFn: () => api.get<ApiResponse<any[]>>('/finance/periods'),
    });
}

export function useGeneralLedger(coaId: string, startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: ['finance', 'gl', coaId, startDate, endDate],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/general-ledger?${new URLSearchParams({ coaId, startDate: startDate || '', endDate: endDate || '' })}`),
        enabled: !!coaId,
    });
}

export function usePnLReport(startDate?: string, endDate?: string, dapurId?: string) {
    return useQuery({
        queryKey: ['finance', 'reports', 'pnl', startDate, endDate, dapurId],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/reports/pl?${new URLSearchParams({ startDate: startDate || '', endDate: endDate || '', dapurId: dapurId || '' })}`),
    });
}

export function useClosePeriod() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.post<ApiResponse<any>>(`/finance/periods/${id}/close`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'periods'] });
        },
    });
}

// ─── Recipes (BOM) ───────────────────────────────────────────────────────────
export function useRecipes() {
    return useQuery({
        queryKey: ['recipes'],
        queryFn: () => api.get<ApiResponse<any[]>>('/recipes'),
    });
}

export function useCreateRecipe() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.post<ApiResponse<any>>('/recipes', data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
    });
}

export function useUpdateRecipe() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.put<ApiResponse<any>>(`/recipes/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
    });
}

export function useDeleteRecipe() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.delete<ApiResponse<any>>(`/recipes/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
    });
}

// ─── Consumption (Pemakaian Bahan) ───────────────────────────────────────────
export function useConsumption(dapurId?: string) {
    const params = dapurId ? `?dapurId=${dapurId}` : '';
    return useQuery({
        queryKey: ['supply-chain', 'consumption', dapurId],
        queryFn: () => api.get<ApiResponse<any[]>>(`/supply-chain/consumption${params}`),
    });
}

export function useCreateConsumption() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.post<ApiResponse<any>>('/supply-chain/consumption', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supply-chain', 'consumption'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
            queryClient.invalidateQueries({ queryKey: ['journals'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        },
    });
}

// ─── Inventory Adjustments ───────────────────────────────────────────────────
export function useCreateAdjustment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.post<ApiResponse<any>>('/inventory/adjustments', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
        },
    });
}

export function useInventoryMovements(itemId?: string) {
    const params = itemId ? `?itemId=${itemId}` : '';
    return useQuery({
        queryKey: ['inventory', 'movements', itemId],
        queryFn: () => api.get<ApiResponse<any[]>>(`/inventory/movements${params}`),
    });
}

export function useLowStock() {
    return useQuery({
        queryKey: ['inventory', 'stock', 'low'],
        queryFn: () => api.get<ApiResponse<any[]>>('/inventory/stock/low'),
    });
}

// ─── Balance Sheet Report ────────────────────────────────────────────────────
export function useBalanceSheet(endDate?: string) {
    return useQuery({
        queryKey: ['finance', 'reports', 'balance-sheet', endDate],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/reports/balance-sheet?${new URLSearchParams({ endDate: endDate || '' })}`),
    });
}

// ─── Finance Dashboard ───────────────────────────────────────────────────────
export function useFinanceDashboard(startDate?: string, endDate?: string, dapurId?: string) {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (dapurId) params.set('dapurId', dapurId)
    const qs = params.toString() ? '?' + params.toString() : ''
    return useQuery({
        queryKey: ['finance', 'dashboard', startDate, endDate, dapurId],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/finance-dashboard${qs}`),
    });
}

// ─── Cash Flow Report ────────────────────────────────────────────────────────
export function useCashFlow(startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const qs = params.toString() ? '?' + params.toString() : ''
    return useQuery({
        queryKey: ['finance', 'reports', 'cash-flow', startDate, endDate],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/reports/cash-flow${qs}`),
    });
}

// ─── Finance Analysis ────────────────────────────────────────────────────────
export function useFinanceAnalysis(startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const qs = params.toString() ? '?' + params.toString() : ''
    return useQuery({
        queryKey: ['finance', 'reports', 'analysis', startDate, endDate],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/reports/analysis${qs}`),
    });
}

// ─── PO Approval ─────────────────────────────────────────────────────────────
export function useApprovePO() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.patch<ApiResponse<any>>(`/purchase/orders/${id}/approve`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase', 'orders'] });
        },
    });
}

export function useRejectPO() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.patch<ApiResponse<any>>(`/purchase/orders/${id}/reject`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase', 'orders'] });
        },
    });
}

// ─── Price History ───────────────────────────────────────────────────────────
export function usePriceHistory(vendorId?: string, itemId?: string) {
    const params = new URLSearchParams()
    if (vendorId) params.set('vendorId', vendorId)
    if (itemId) params.set('itemId', itemId)
    const qs = params.toString() ? '?' + params.toString() : ''
    return useQuery({
        queryKey: ['price-history', vendorId, itemId],
        queryFn: () => api.get<ApiResponse<any[]>>(`/price-history${qs}`),
        enabled: !!vendorId || !!itemId,
    });
}

export function useLatestPrice(vendorId?: string, itemId?: string) {
    return useQuery({
        queryKey: ['price-history', 'latest', vendorId, itemId],
        queryFn: () => api.get<ApiResponse<any>>(`/price-history/latest?vendorId=${vendorId}&itemId=${itemId}`),
        enabled: !!vendorId && !!itemId,
    });
}

// ─── Kitchen Billing ─────────────────────────────────────────────────────────
export function useKitchenBilling(month?: number, year?: number, dapurId?: string) {
    const params = new URLSearchParams()
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    if (dapurId) params.set('dapurId', dapurId)
    const qs = params.toString() ? '?' + params.toString() : ''
    return useQuery({
        queryKey: ['kitchen-billing', month, year, dapurId],
        queryFn: () => api.get<ApiResponse<any>>(`/kitchen-billing${qs}`),
    });
}
