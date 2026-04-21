/**
 * Typed API Client for ERP MBG
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export type ApiResponse<T> = {
    data: T;
    total?: number;
    error?: string;
    message?: string;
};

async function handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || data.message || 'API request failed');
    }
    return data;
}

export const api = {
    get: async <T>(endpoint: string): Promise<T> => {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
        });
        return handleResponse<T>(res);
    },

    post: async <T>(endpoint: string, body: any): Promise<T> => {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    patch: async <T>(endpoint: string, body: any): Promise<T> => {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    delete: async <T>(endpoint: string): Promise<T> => {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'DELETE',
        });
        return handleResponse<T>(res);
    },
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Item {
    id: string;
    sku: string;
    name: string;
    category: string;
    uom: string;
    description?: string;
    minStock: number;
    isActive: boolean;
}

export interface Vendor {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    category?: string;
    isActive: boolean;
}

export interface Dapur {
    id: string;
    code: string;
    name: string;
    location?: string;
    picName?: string;
    isActive: boolean;
}

export interface Gudang {
    id: string;
    code: string;
    name: string;
    location?: string;
}

export interface Coa {
    id: string;
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    level: number;
}
