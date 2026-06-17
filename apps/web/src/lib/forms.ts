import type { UseFormRegisterReturn } from 'react-hook-form'
import type { ZodError } from 'zod'

/** A FormData entry as a string (entries can also be a File). Used by the auth
 *  forms, which read values from the DOM via FormData on submit so browser /
 *  password-manager autofill is captured (autofill sets .value without firing a
 *  React onChange, so component-state libraries miss it). */
export function formString(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v : ''
}

/** First error message per field from a zod safeParse failure. */
export function zodFieldErrors(err: ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {}
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !(key in out)) out[key] = issue.message
  }
  return out
}

// react-hook-form's register() returns its DOM ref as `ref`, but Blueprint inputs
// (InputGroup/TextArea, class components) only wire the native <input> ref through
// the `inputRef` prop — a plain {...register()} spread lands the ref on the class
// instance, so RHF never gets a DOM ref. It then relies solely on React onChange
// events, which means browser-autofilled / password-manager values (and setValue/
// reset) never reach validation and every field reads as empty. Mapping ref →
// inputRef fixes it.
export function bpRegister<T extends UseFormRegisterReturn>(reg: T): Omit<T, 'ref'> & { inputRef: T['ref'] } {
  const { ref, ...rest } = reg
  return { ...rest, inputRef: ref }
}
