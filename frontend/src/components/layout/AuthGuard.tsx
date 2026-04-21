import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../../lib/auth-client'

export default function AuthGuard() {
    const { data: session, isPending } = useSession()

    if (isPending) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
                Loading session...
            </div>
        )
    }

    if (!session) {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}
