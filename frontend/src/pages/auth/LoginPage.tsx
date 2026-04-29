import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, authClient } from '../../lib/auth-client'
import { LogIn } from 'lucide-react'
import Button from '../../components/ui/Button'
import styles from './LoginPage.module.css'

export default function LoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const result = await signIn.email({
                email,
                password,
            })

            if (result.error) {
                setError(result.error.message || 'Login failed. Invalid credentials.')
            } else {
                navigate('/dashboard', { replace: true })
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.')
        } finally {
            setLoading(false)
        }
    }

    const handleSignup = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await authClient.signUp.email({
                email,
                password,
                name: 'Super Admin'
            })
            if (res.error) {
                setError(res.error.message || 'Failed to create account')
            } else {
                navigate('/dashboard', { replace: true })
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sign up')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <img src="/logo.png" alt="ERP MBG" style={{ height: 56, objectFit: 'contain', marginBottom: 12 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <h1 className={styles.title}>ERP MBG System</h1>
                    <p className={styles.subtitle}>Sign in to access your operational dashboard</p>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.field}>
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className={styles.input}
                            placeholder="admin@mbg.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className={styles.input}
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        disabled={loading}
                        style={{ width: '100%', marginTop: '0.5rem' }}
                    >
                        {loading ? 'Processing...' : 'Sign In'}
                    </Button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    Admin account doesn't exist? <br />
                    <button
                        type="button"
                        onClick={handleSignup}
                        disabled={loading}
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, marginTop: '0.5rem' }}
                    >
                        Create account using above email/password
                    </button>
                </div>
            </div>
        </div>
    )
}
