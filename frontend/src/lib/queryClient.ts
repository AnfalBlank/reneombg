import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30,        // 30 detik — data dianggap stale setelah 30 detik
            gcTime: 1000 * 60 * 5,       // cache tetap di memory 5 menit
            retry: 1,
            refetchOnWindowFocus: true,  // refetch otomatis saat tab/window kembali aktif
            refetchOnMount: true,        // refetch saat komponen mount jika data stale
        },
    },
});
