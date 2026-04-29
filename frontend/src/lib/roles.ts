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

/** Check if user has one of the allowed roles */
export function hasRole(userRole: string, ...allowed: RoleKey[]): boolean {
    return allowed.includes(userRole as RoleKey)
}

/** Check if user can access admin features */
export function isAdmin(role: string): boolean {
    return hasRole(role, 'owner', 'super_admin')
}

/** Navigation items filtered by role */
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
}

export function getNavAccess(role: string): NavAccess {
    switch (role) {
        case 'owner':
            return { dashboard: true, masterData: true, purchase: true, inventory: true, supplyChain: true, accounting: true, reports: true, finance: true, settings: true, adminPanel: true }
        case 'super_admin':
            return { dashboard: true, masterData: true, purchase: true, inventory: true, supplyChain: true, accounting: true, reports: true, finance: true, settings: true, adminPanel: true }
        case 'admin':
            return { dashboard: true, masterData: true, purchase: true, inventory: true, supplyChain: true, accounting: true, reports: true, finance: false, settings: false, adminPanel: false }
        case 'kitchen_admin':
            return { dashboard: true, masterData: false, purchase: false, inventory: true, supplyChain: true, accounting: false, reports: false, finance: false, settings: false, adminPanel: false }
        case 'finance':
            return { dashboard: true, masterData: false, purchase: true, inventory: false, supplyChain: false, accounting: true, reports: true, finance: true, settings: false, adminPanel: false }
        default:
            return { dashboard: true, masterData: false, purchase: false, inventory: false, supplyChain: false, accounting: false, reports: false, finance: false, settings: false, adminPanel: false }
    }
}
