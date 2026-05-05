import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        // Load .env so DB-importing modules don't throw during test collection
        env: {
            TURSO_DATABASE_URL: 'libsql://test.turso.io',
            TURSO_AUTH_TOKEN: 'test-token',
            AUTH_SECRET: 'test-secret',
        },
    },
})
