import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db/index'
import * as schema from '../db/schema/index'

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'sqlite',
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
        },
    }),

    secret: process.env.AUTH_SECRET || 'erp-mbg-secret-fallback',
    baseURL: process.env.BASE_URL || 'http://localhost:3000/api/auth',

    // Enable email & password authentication
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },

    // Session configuration
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 24 * 7, // 7 days
        },
    },

    // Trust frontend origin for CORS
    trustedOrigins: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
    ],

    // Custom user fields for role-based access
    user: {
        additionalFields: {
            role: {
                type: 'string',
                required: false,
                defaultValue: 'kitchen_admin',
                input: true,
            },
            dapurId: {
                type: 'string',
                required: false,
                input: true,
            },
        },
    },
})

export type AuthUser = typeof auth.$Infer.Session.user
