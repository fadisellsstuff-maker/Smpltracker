import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const KEY = 'smpltrack.persona'

/** Detect the secret "/onlyformygf" path (or a previously stored flag). */
function detectGf(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (window.location.pathname.toLowerCase().includes('onlyformygf')) return true
    return localStorage.getItem(KEY) === 'gf'
  } catch {
    return false
  }
}

interface PersonaCtx {
  gf: boolean
  setGf: (on: boolean) => void
}

const Ctx = createContext<PersonaCtx>({ gf: false, setGf: () => {} })

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [gf, setGfState] = useState<boolean>(() => detectGf())

  // Persist + drive the CSS accent swap via a root attribute.
  useEffect(() => {
    if (gf) localStorage.setItem(KEY, 'gf')
    else localStorage.removeItem(KEY)
    document.documentElement.dataset.persona = gf ? 'gf' : ''
  }, [gf])

  return <Ctx.Provider value={{ gf, setGf: setGfState }}>{children}</Ctx.Provider>
}

export function usePersona(): PersonaCtx {
  return useContext(Ctx)
}

/** Accent hexes for inline SVG/chart colors (Tailwind classes are swapped via CSS). */
export const ACCENT = {
  green: { primary: '#22c55e', line: '#4ade80' },
  pink: { primary: '#ec4899', line: '#f472b6' },
}
