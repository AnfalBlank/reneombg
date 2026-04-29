import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_AUTH_URL || `${window.location.origin}/api/auth`
})

export const { signIn, signOut, useSession } = authClient
