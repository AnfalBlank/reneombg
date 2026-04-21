import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiResponse, Item, Vendor, Dapur, Coa } from '../lib/api';

// ─── Dashboard ───────────────────────────────────────────────────────────────
export function useDashboardSummary() {
    return useQuery({
        queryKey: ['dashboard-summary'],
        queryFn: () => api.get<ApiResponse<any>>('/finance/dashboard-summary'),
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

// ─── Vendors ──────────────────────────────────────────────────────────────────
export function useVendors() {
    return useQuery({
        queryKey: ['vendors'],
        queryFn: () => api.get<ApiResponse<Vendor[]>>('/vendors'),
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

// ─── Finance ──────────────────────────────────────────────────────────────────
export function useCoa() {
    return useQuery({
        queryKey: ['master', 'coa'],
        queryFn: () => api.get<ApiResponse<Coa[]>>('/master/coa'),
    });
}

export function useJournalEntries() {
    return useQuery({
        queryKey: ['journals'],
        queryFn: () => api.get<ApiResponse<any[]>>('/finance/journal'),
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

export function useDeliveryOrders() {
    return useQuery({
        queryKey: ['supply-chain', 'delivery-orders'],
        queryFn: () => api.get<ApiResponse<any[]>>('/supply-chain/delivery-orders'),
    });
}

export function useKitchenReceivings() {
    return useQuery({
        queryKey: ['supply-chain', 'kitchen-receiving'],
        queryFn: () => api.get<ApiResponse<any[]>>('/supply-chain/kitchen-receiving'),
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

export function useGeneralLedger(coaId: string, periodId?: string) {
    return useQuery({
        queryKey: ['finance', 'gl', coaId, periodId],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/general-ledger?coaId=${coaId}${periodId ? `&periodId=${periodId}` : ''}`),
        enabled: !!coaId,
    });
}

export function usePnLReport(periodId?: string, dapurId?: string) {
    return useQuery({
        queryKey: ['finance', 'reports', 'pnl', periodId, dapurId],
        queryFn: () => api.get<ApiResponse<any>>(`/finance/reports/pl?${new URLSearchParams({ periodId: periodId || '', dapurId: dapurId || '' })}`),
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
