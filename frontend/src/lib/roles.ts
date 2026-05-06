export const ROLES = {
    owner: { label: 'Owner', color: 'red' as const },
    super_admin: { label: 'Super Admin', color: 'red' as const },
    admin: { label: 'Admin Pusat', color: 'yellow' as const },
    kitchen_admin: { label: 'Admin Dapur', color: 'blue' as const },
    finance: { label: 'Finance', color: 'purple' as const },
}

export type RoleKey = keyof typeof ROLES

export function getRoleLabel(role: string) {
    return ROLES[role as RoleKey] || { label: role, color: 'gray' as const }
}

export function hasRole(userRole: string, ...allowed: RoleKey[]): boolean {
    return allowed.includes(userRole as RoleKey)
}

export function isAdmin(role: string): boolean {
    return hasRole(role, 'owner', 'super_admin')
}

export function canApprove(role: string): boolean {
    return hasRole(role, 'owner', 'super_admin', 'admin')
}

export interface NavAccess {
    dashboard: boolean
    masterData: boolean
    purchase: boolean
    inventory: boolean
    supplyChain: boolean
    accounting: boolean
    reports: boolean
    finance: boolean
    settings: boolean
    adminPanel: boolean
    approval: boolean
}

export function getNavAccess(role: string): NavAccess {
    switch (role) {
        case 'owner':
            // Owner: hanya Executive Dashboard, Approval, Laporan
            return {
                dashboard: false,   // langsung redirect ke /executive
                masterData: false,
                purchase: false,
                inventory: false,
                supplyChain: false,
                accounting: false,
                reports: true,      // Laporan Operasional
                finance: true,      // Laporan Keuangan (P&L, Balance Sheet)
                settings: false,
                adminPanel: false,
                approval: true,     // Approval Center
            }
        case 'super_admin':
            // Super Admin: akses penuh semua fitur
            return {
                dashboard: true, masterData: true, purchase: true, inventory: true,
                supplyChain: true, accounting: true, reports: true, finance: true,
                settings: true, adminPanel: true, approval: true,
            }
        case 'admin':
            // Admin Pusat: operasional penuh + finance + pengaturan user (tanpa admin panel)
            return {
                dashboard: true, masterData: true, purchase: true, inventory: true,
                supplyChain: true, accounting: true, reports: true,
                finance: true,      // ✅ Arus Kas & Finance
                settings: true,     // ✅ Pengaturan User (tanpa admin panel)
                adminPanel: false,
                approval: true,
            }
        case 'kitchen_admin':
            // Admin Dapur: hanya supply chain dapur sendiri
            return {
                dashboard: true, masterData: false, purchase: false, inventory: false,
                supplyChain: true, accounting: false, reports: false, finance: false,
                settings: false, adminPanel: false, approval: false,
            }
        case 'finance':
            return {
                dashboard: true, masterData: false, purchase: true, inventory: false,
                supplyChain: false, accounting: true, reports: true, finance: true,
                settings: false, adminPanel: false, approval: false,
            }
        default:
            return {
                dashboard: true, masterData: false, purchase: false, inventory: false,
                supplyChain: false, accounting: false, reports: false, finance: false,
                settings: false, adminPanel: false, approval: false,
            }
    }
}
