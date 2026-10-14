// Receptúry, ich riadky a suroviny pre kalkuláciu surovín (lib/ingredientCalc) —
// spoločné pre dashboard (KALKULÁCIA SUROVÍN za vybraté dni) a menu rezervácie
// (karta Kalkulácia surovín). Aj vymazané suroviny — receptúry ich ďalej počítajú.
import { supabase } from './supabase'
import { fetchAllRows } from './ingredients'

// Chyba → výnimka so správou
export async function loadRecipeData() {
  const [r, l, i, c] = await Promise.all([
    supabase.from('menu_item_recipes').select('item_id, is_ingredient, yield_amount, yield_unit'),
    fetchAllRows((from, to) => supabase
      .from('menu_item_recipe_lines')
      .select('id, item_id, variant_id, ingredient_id, amount, unit')
      .order('id')
      .range(from, to)),
    supabase.from('ingredients').select('id, category_id, name, unit, position, archived_at, menu_item_id'),
    supabase.from('ingredient_categories').select('id, name, position, archived_at'),
  ])
  const err = r.error || l.error || i.error || c.error
  if (err) throw new Error(err.message)
  return { recipes: r.data ?? [], lines: l.data, ingredients: i.data ?? [], categories: c.data ?? [] }
}
