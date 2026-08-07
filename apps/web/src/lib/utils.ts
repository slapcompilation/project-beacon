/** Join class names, dropping falsy ones.
 *
 *  Was clsx + twMerge. twMerge exists to resolve TAILWIND class conflicts and
 *  there is no Tailwind — the utilities in globals.css are ours and do not
 *  collide, so the merge step had nothing left to do. */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(' ')
}
