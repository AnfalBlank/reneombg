import { Hono } from 'hono'
import { db } from '../db'
import { recipes, recipeIngredients, items } from '../db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { z } from 'zod'

const router = new Hono()

const createRecipeSchema = z.object({
    code: z.string(),
    name: z.string(),
    defaultYield: z.number().default(1),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
    ingredients: z.array(z.object({
        itemId: z.string(),
        quantity: z.number(),
        uom: z.string(),
    })).optional()
})

const updateRecipeSchema = createRecipeSchema.partial()

// Get all recipes
router.get('/', async (c) => {
    try {
        const allRecipes = await db.query.recipes.findMany({
            with: {
                ingredients: {
                    with: {
                        item: true
                    }
                }
            },
            orderBy: (recipes, { desc }) => [desc(recipes.createdAt)]
        })
        return c.json({ success: true, data: allRecipes })
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500)
    }
})

// Get recipe by ID
router.get('/:id', async (c) => {
    try {
        const recipe = await db.query.recipes.findFirst({
            where: eq(recipes.id, c.req.param('id')),
            with: {
                ingredients: {
                    with: {
                        item: true
                    }
                }
            }
        })
        if (!recipe) return c.json({ success: false, error: 'Recipe not found' }, 404)
        return c.json({ success: true, data: recipe })
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500)
    }
})

// Create recipe
router.post('/', async (c) => {
    try {
        const body = await c.req.json()
        const parsed = createRecipeSchema.parse(body)

        const recipeId = crypto.randomUUID()
        const now = new Date()

        await db.transaction(async (tx) => {
            await tx.insert(recipes).values({
                id: recipeId,
                code: parsed.code,
                name: parsed.name,
                defaultYield: parsed.defaultYield,
                description: parsed.description,
                isActive: parsed.isActive,
                createdAt: now,
                updatedAt: now,
            })

            if (parsed.ingredients && parsed.ingredients.length > 0) {
                const ingredientsToInsert = parsed.ingredients.map(ing => ({
                    id: crypto.randomUUID(),
                    recipeId,
                    itemId: ing.itemId,
                    quantity: ing.quantity,
                    uom: ing.uom,
                    createdAt: now,
                    updatedAt: now,
                }))
                await tx.insert(recipeIngredients).values(ingredientsToInsert)
            }
        })

        return c.json({ success: true, data: { id: recipeId } })
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400)
    }
})

// Update recipe
router.put('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const body = await c.req.json()
        const parsed = updateRecipeSchema.parse(body)
        const now = new Date()

        await db.transaction(async (tx) => {
            await tx.update(recipes).set({
                code: parsed.code,
                name: parsed.name,
                defaultYield: parsed.defaultYield,
                description: parsed.description,
                isActive: parsed.isActive,
                updatedAt: now,
            }).where(eq(recipes.id, id))

            if (parsed.ingredients !== undefined) {
                // Delete old ingredients
                await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id))
                // Insert new ones
                if (parsed.ingredients.length > 0) {
                    const ingredientsToInsert = parsed.ingredients.map(ing => ({
                        id: crypto.randomUUID(),
                        recipeId: id,
                        itemId: ing.itemId,
                        quantity: ing.quantity,
                        uom: ing.uom,
                        createdAt: now,
                        updatedAt: now,
                    }))
                    await tx.insert(recipeIngredients).values(ingredientsToInsert)
                }
            }
        })

        return c.json({ success: true })
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400)
    }
})

// Delete recipe
router.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        await db.transaction(async (tx) => {
            await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id))
            await tx.delete(recipes).where(eq(recipes.id, id))
        })
        return c.json({ success: true })
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500)
    }
})

export default router
