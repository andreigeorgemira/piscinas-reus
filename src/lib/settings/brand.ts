import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The company's mark, built from its name in Ajustes rather than drawn: the app
 * serves any trade, so the only identity it can honestly show is the one the
 * company typed in.
 */

/** "Piscinas Reus" → "PR", "Reformas" → "RE", "  " → "·". */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
  if (words.length === 0) return '·'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

/**
 * The trade name, or null when it cannot be read. Never throws: the places that
 * show it (the sign-in screen, the sidebar) must still render with no
 * database behind them, and they fall back to a generic label.
 */
export async function readTradeName(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('company_settings').select('trade_name').eq('id', true).maybeSingle()
    if (error || !data) return null
    return (data as { trade_name: string }).trade_name
  } catch {
    return null
  }
}
