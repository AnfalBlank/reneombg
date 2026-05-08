/**
 * useIdleTimeout
 * ─────────────────────────────────────────────────────────────────────────────
 * Auto-logout user setelah tidak ada aktivitas selama `timeoutMs` milidetik.
 * Aktivitas yang dihitung: mousemove, mousedown, keydown, touchstart, scroll, click.
 *
 * Menampilkan warning 2 menit sebelum logout agar user bisa extend session.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { signOut } from '../lib/auth-client'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000       // 30 menit
const WARNING_BEFORE_MS = 2 * 60 * 1000       // warning 2 menit sebelum logout

const ACTIVITY_EVENTS = [
    'mousemove', 'mousedown', 'keydown',
    'touchstart', 'scroll', 'click',
] as const

export function useIdleTimeout() {
    const [showWarning, setShowWarning] = useState(false)
    const [secondsLeft, setSecondsLeft] = useState(0)

    const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null)

    const clearAllTimers = () => {
        if (logoutTimer.current) clearTimeout(logoutTimer.current)
        if (warningTimer.current) clearTimeout(warningTimer.current)
        if (countdownInterval.current) clearInterval(countdownInterval.current)
    }

    const doLogout = useCallback(async () => {
        clearAllTimers()
        setShowWarning(false)
        await signOut()
        window.location.href = '/login?reason=idle'
    }, [])

    const resetTimers = useCallback(() => {
        clearAllTimers()
        setShowWarning(false)

        // Set warning timer (28 menit)
        warningTimer.current = setTimeout(() => {
            setShowWarning(true)
            setSecondsLeft(WARNING_BEFORE_MS / 1000)

            // Countdown setiap detik
            countdownInterval.current = setInterval(() => {
                setSecondsLeft(prev => {
                    if (prev <= 1) {
                        if (countdownInterval.current) clearInterval(countdownInterval.current)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)

        // Set logout timer (30 menit)
        logoutTimer.current = setTimeout(doLogout, IDLE_TIMEOUT_MS)
    }, [doLogout])

    // Extend session — user klik "Tetap Login"
    const extendSession = useCallback(() => {
        resetTimers()
    }, [resetTimers])

    useEffect(() => {
        // Mulai timer saat hook dipasang
        resetTimers()

        // Attach activity listeners
        const handleActivity = () => resetTimers()
        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true })
        })

        return () => {
            clearAllTimers()
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity)
            })
        }
    }, [resetTimers])

    return { showWarning, secondsLeft, extendSession, doLogout }
}
