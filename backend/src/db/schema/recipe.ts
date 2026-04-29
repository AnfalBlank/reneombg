import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { items } from './master'

// ─── Master Recipe (BOM Header) ────────────────────────────────────────────────
export const recipes = sqliteTable('recipes', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // e.g. RCP-001
    name: text('name').notNull(), // e.g. Menu A
    defaultYield: real('default_yield').notNull().default(1), // e.g. 1000 porsi
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Recipe Ingredients (BOM Detail) ───────────────────────────────────────────
export const recipeIngredients = sqliteTable('recipe_ingredients', {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id').notNull().references(() => recipes.id),
    itemId: text('item_id').notNull().references(() => items.id), // refers to raw material
    quantity: real('quantity').notNull(), // quantity needed for defaultYield
    uom: text('uom').notNull(), // unit of measure for this specific ingredient quantity
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Recipe = typeof recipes.$inferSelect
export type NewRecipe = typeof recipes.$inferInsert
export type RecipeIngredient = typeof recipeIngredients.$inferSelect
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert

export const recipeRelations = relations(recipes, ({ many }) => ({
    ingredients: many(recipeIngredients),
}))

export const recipeIngredientRelations = relations(recipeIngredients, ({ one }) => ({
    recipe: one(recipes, {
        fields: [recipeIngredients.recipeId],
        references: [recipes.id],
    }),
    item: one(items, {
        fields: [recipeIngredients.itemId],
        references: [items.id],
    }),
}))
