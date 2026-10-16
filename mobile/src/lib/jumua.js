// Jumu'a de la mosquée choisie (comme sur Mawaqit) : Dhuhr reste dans la liste, la Jumu'a s'affiche à part.

/** Jumu'a du vendredi qui vient à la mosquée choisie : { day, today, times, instants } ou null. */
export const jumuaOf = (source) => (source?.mode === 'mosquee' && source.friday?.times?.length ? source.friday : null);
