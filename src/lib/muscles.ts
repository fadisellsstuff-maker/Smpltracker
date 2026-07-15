/** Fixed muscle-group taxonomy used by the catalog, heat map, and insights. */
export const MUSCLES = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'lats',
  'traps',
  'upper-back',
  'lower-back',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
] as const

export type Muscle = (typeof MUSCLES)[number]

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  'front-delts': 'Front Delts',
  'side-delts': 'Side Delts',
  'rear-delts': 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lats: 'Lats',
  traps: 'Traps',
  'upper-back': 'Upper Back',
  'lower-back': 'Lower Back',
  abs: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
}

/**
 * Maps the vendored react-body-highlighter polygon slugs to our muscle groups.
 * A polygon's heat level is the max level among the muscles listed here.
 * (side-delts and lats have no library polygon — they're drawn as overlays.)
 */
export const SLUG_TO_MUSCLES: Record<string, Muscle[]> = {
  chest: ['chest'],
  'front-deltoids': ['front-delts'],
  'back-deltoids': ['rear-delts'],
  trapezius: ['traps'],
  'upper-back': ['upper-back'],
  'lower-back': ['lower-back'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearm: ['forearms'],
  abs: ['abs'],
  obliques: ['obliques'],
  quadriceps: ['quads'],
  hamstring: ['hamstrings'],
  gluteal: ['glutes'],
  calves: ['calves'],
  'left-soleus': ['calves'],
  'right-soleus': ['calves'],
  adductor: ['adductors'],
  abductors: ['adductors'],
  // head, neck, knees → no muscle (rendered as neutral base)
}

/** Coarse split used by the training-balance insight. */
export type SplitGroup = 'push' | 'pull' | 'legs' | 'core'

export const MUSCLE_SPLIT: Record<Muscle, SplitGroup> = {
  chest: 'push',
  'front-delts': 'push',
  'side-delts': 'push',
  triceps: 'push',
  'rear-delts': 'pull',
  biceps: 'pull',
  forearms: 'pull',
  lats: 'pull',
  traps: 'pull',
  'upper-back': 'pull',
  'lower-back': 'core',
  abs: 'core',
  obliques: 'core',
  glutes: 'legs',
  quads: 'legs',
  hamstrings: 'legs',
  adductors: 'legs',
  calves: 'legs',
}
