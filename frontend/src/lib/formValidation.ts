export type ValidationControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
export type ValidationMessage = { key: string; values?: Record<string, unknown> }
export function validationMessage(control: Pick<ValidationControl, 'validity'> & { type?: string; minLength?: number; maxLength?: number; min?: string; max?: string }): ValidationMessage | null {
  const v = control.validity
  if (v.valueMissing) return { key: 'This field is required' }
  if (v.typeMismatch) return { key: control.type === 'email' ? 'Please enter a valid email address' : 'Please enter a valid URL' }
  if (v.badInput) return { key: 'Please enter a number' }
  if (v.patternMismatch) return { key: 'Please match the requested format' }
  if (v.tooShort) return { key: 'Please use at least {{count}} characters', values: { count: control.minLength } }
  if (v.tooLong) return { key: 'Please use no more than {{count}} characters', values: { count: control.maxLength } }
  if (v.rangeUnderflow) return { key: 'Please enter a value of at least {{value0}}', values: { value0: control.min } }
  if (v.rangeOverflow) return { key: 'Please enter a value no greater than {{value0}}', values: { value0: control.max } }
  if (v.stepMismatch) return { key: 'Please enter a valid value' }
  return null
}
