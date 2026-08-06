// The dataset layer's vocabulary, as Foundry defines it.
//
// Two rules govern this file. Every value traces to `data-integration/datasets`,
// and nothing here duplicates logic that belongs in SQL: the view algorithm and
// the commit rules live in the database (migrations 392–394), because a trigger
// is the only place a rule cannot be walked around. What lives here is the
// grammar the UI needs to render and validate a schema before submitting it.

/** "Below is a list of field types available for datasets" — all fifteen. */
export type FieldType =
  | 'BOOLEAN' | 'BYTE' | 'SHORT' | 'INTEGER' | 'LONG' | 'FLOAT' | 'DOUBLE'
  | 'DECIMAL' | 'STRING' | 'MAP' | 'ARRAY' | 'STRUCT' | 'BINARY' | 'DATE' | 'TIMESTAMP'

export interface DatasetField {
  /** Column name. Absent on the nested field types, which describe a shape not a column. */
  name?: string
  type: FieldType
  /** DECIMAL. "a good default is precision: 38 and scale: 18." */
  precision?: number
  scale?: number
  /** ARRAY. "requires arraySubType, a field type." */
  arraySubType?: DatasetField
  /** MAP. "requires mapKeyType and mapValueType, which are both field types." */
  mapKeyType?: DatasetField
  mapValueType?: DatasetField
  /** STRUCT. "requires subSchemas, a list of field types." */
  subSchemas?: DatasetField[]
}

export const FIELD_TYPES: { value: FieldType; label: string; help: string }[] = [
  { value: 'BOOLEAN',   label: 'Boolean',   help: 'True or false.' },
  { value: 'BYTE',      label: 'Byte',      help: 'A whole number, 8 bits.' },
  { value: 'SHORT',     label: 'Short',     help: 'A whole number, 16 bits.' },
  { value: 'INTEGER',   label: 'Integer',   help: 'A whole number, 32 bits.' },
  { value: 'LONG',      label: 'Long',      help: 'A whole number, 64 bits.' },
  { value: 'FLOAT',     label: 'Float',     help: 'An approximate decimal, 32 bits.' },
  { value: 'DOUBLE',    label: 'Double',    help: 'An approximate decimal, 64 bits.' },
  { value: 'DECIMAL',   label: 'Decimal',   help: 'An exact decimal. Needs a precision and a scale — 38 and 18 are the usual defaults.' },
  { value: 'STRING',    label: 'String',    help: 'Text.' },
  { value: 'MAP',       label: 'Map',       help: 'Key-value pairs. Not valid as a property base type.' },
  { value: 'ARRAY',     label: 'Array',     help: 'Several values of one type.' },
  { value: 'STRUCT',    label: 'Struct',    help: 'Named fields grouped into one value.' },
  { value: 'BINARY',    label: 'Binary',    help: 'Raw bytes. Not valid as a property base type.' },
  { value: 'DATE',      label: 'Date',      help: 'A calendar date.' },
  { value: 'TIMESTAMP', label: 'Timestamp', help: 'A point in time.' },
]

/** "All field types are valid base types except for `Map` and `Binary` types."
 *  Kept here because the exclusion is a fact about FIELD types; what a property
 *  may then be is the ontology's business. */
export const NOT_A_BASE_TYPE: ReadonlyArray<FieldType> = ['MAP', 'BINARY']

export type TransactionType = 'SNAPSHOT' | 'APPEND' | 'UPDATE' | 'DELETE'
export type TransactionStatus = 'OPEN' | 'COMMITTED' | 'ABORTED'

/** The four types, each with the sentence that defines it. The `help` strings
 *  are quotes, not paraphrases — they are what a tooltip should say. */
export const TRANSACTION_TYPES: { value: TransactionType; label: string; help: string }[] = [
  { value: 'SNAPSHOT', label: 'Snapshot', help: 'Replaces the current view of the dataset with a completely new set of files. Begins a new view.' },
  { value: 'APPEND',   label: 'Append',   help: 'Adds new files to the current dataset view. Cannot modify existing files — a commit that overwrites one will fail.' },
  { value: 'UPDATE',   label: 'Update',   help: 'Adds new files, and may also overwrite the contents of existing files. Breaks incrementality for anything downstream.' },
  { value: 'DELETE',   label: 'Delete',   help: 'Removes files from the current view. Does not delete the underlying data — that is a retention policy’s job.' },
]

export const TRANSACTION_STATUSES: { value: TransactionStatus; label: string; help: string }[] = [
  { value: 'OPEN',      label: 'Open',      help: 'Files can be written. A branch may have only one open transaction, and it is always the latest.' },
  { value: 'COMMITTED', label: 'Committed', help: 'The written files are now in the latest dataset view.' },
  { value: 'ABORTED',   label: 'Aborted',   help: 'Any files written during the transaction are ignored.' },
]

export interface Dataset {
  id: string
  rid: string
  organizationId: string
  projectId: string
  apiName: string
  name: string
  description: string
  /** The table in the `datasets` schema. Null while the dataset is schema-less,
   *  which Foundry also allows — "Upload to a dataset without a schema". */
  physicalTable: string | null
  createdAt: string
  updatedAt: string
}

export interface DatasetBranch {
  id: string
  datasetId: string
  name: string
  /** Null for a root branch. "Each dataset branch has exactly one parent branch,
   *  unless it is a root branch." */
  parentBranchId: string | null
  /** "dataset branches are simply a pointer to the most recent transaction." */
  headTransactionId: string | null
}

export interface DatasetTransaction {
  id: string
  rid: string
  datasetId: string
  branchId: string
  txnType: TransactionType
  status: TransactionStatus
  parentTransactionId: string | null
  startedAt: string
  committedAt: string | null
  abortedAt: string | null
}

export interface DatasetFile {
  id: string
  logicalPath: string
  rowCount: number
}

export interface Validation { ok: boolean; errors: string[] }

const NAME_RE = /^[a-z][a-z0-9_]*$/
const TYPES = new Set<string>(FIELD_TYPES.map((t) => t.value))

/** One field, including the parameters its type requires. Mirrors
 *  `dataset_field_valid` in migration 392 — the database is the floor, this is
 *  what stops a bad schema reaching it. */
function fieldErrors(f: DatasetField, where: string): string[] {
  if (!TYPES.has(f.type)) return [`${where}: "${String(f.type)}" is not one of the fifteen field types.`]

  switch (f.type) {
    case 'DECIMAL': {
      const { precision: p, scale: s } = f
      if (typeof p !== 'number' || typeof s !== 'number') {
        return [`${where}: Decimal needs a precision and a scale. Try 38 and 18.`]
      }
      // "38 is the highest possible precision value."
      if (!Number.isInteger(p) || p < 1 || p > 38) return [`${where}: precision must be a whole number from 1 to 38.`]
      if (!Number.isInteger(s) || s < 0 || s > p) return [`${where}: scale must be a whole number from 0 to the precision.`]
      return []
    }
    case 'ARRAY':
      if (!f.arraySubType) return [`${where}: Array needs an element type.`]
      return fieldErrors(f.arraySubType, `${where} element`)
    case 'MAP': {
      if (!f.mapKeyType || !f.mapValueType) return [`${where}: Map needs a key type and a value type.`]
      return [...fieldErrors(f.mapKeyType, `${where} key`), ...fieldErrors(f.mapValueType, `${where} value`)]
    }
    case 'STRUCT': {
      const subs = f.subSchemas
      if (!subs || subs.length === 0) return [`${where}: Struct needs at least one field.`]
      return subs.flatMap((s, i) =>
        s.name === undefined || !NAME_RE.test(s.name)
          ? [`${where} field ${String(i + 1)}: needs a lower_snake_case name.`]
          : fieldErrors(s, `${where}.${s.name}`))
    }
    default:
      return []
  }
}

/** A tabular schema: uniquely named columns, each a valid field type. */
export function validateDatasetSchema(fields: DatasetField[]): Validation {
  const errors: string[] = []
  const seen = new Set<string>()
  if (fields.length === 0) errors.push('A schema needs at least one column.')

  for (const [i, f] of fields.entries()) {
    const label = f.name ?? `column ${String(i + 1)}`
    if (f.name === undefined || !NAME_RE.test(f.name)) {
      errors.push(`${label}: needs a lower_snake_case name.`)
      continue
    }
    if (seen.has(f.name)) { errors.push(`Duplicate column "${f.name}".`); continue }
    seen.add(f.name)
    errors.push(...fieldErrors(f, f.name))
  }
  return { ok: errors.length === 0, errors }
}

/** How a field type reads in a column header — Dataset Preview shows the type
 *  under the name, and a parameterised type shows its parameters. */
export function describeField(f: DatasetField): string {
  switch (f.type) {
    case 'DECIMAL': return `Decimal(${String(f.precision ?? '?')},${String(f.scale ?? '?')})`
    case 'ARRAY':   return f.arraySubType ? `Array<${describeField(f.arraySubType)}>` : 'Array<?>'
    case 'MAP':     return f.mapKeyType && f.mapValueType
      ? `Map<${describeField(f.mapKeyType)},${describeField(f.mapValueType)}>` : 'Map<?>'
    case 'STRUCT':  return `Struct{${(f.subSchemas ?? []).map((s) => s.name ?? '?').join(', ')}}`
    default:        return FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type
  }
}
