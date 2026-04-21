import { Context, Next } from 'hono'
import { auth } from '../lib/auth'

// Auth middleware — validates session and attaches user to context
export async function requireAuth(c: Context, next: Next) {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session?.user) {
        return c.json({ error: 'Unauthorized', message: 'Login required' }, 401)
    }

    c.set('user', session.user)
    c.set('session', session.session)
    await next()
}

// Role guard middleware
export function requireRole(...roles: string[]) {
    return async (c: Context, next: Next) => {
        const user = c.get('user')
        if (!user || !roles.includes((user as any).role)) {
            return c.json({ error: 'Forbidden', message: `Required role: ${roles.join(' or ')}` }, 403)
        }
        await next()
    }
}
