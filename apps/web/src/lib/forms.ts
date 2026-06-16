import type { UseFormRegisterReturn } from 'react-hook-form'

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
