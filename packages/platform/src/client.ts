// The client the generated entities are called through.
//
// `client(Restaurant).fetchOne(…)` — the entity is an imported value, and the
// property names are typed keys. "There is no table, no column literal, no join
// to spell wrong." Ours is the same idea over Postgres functions: an entity is a
// value, its parameters are a typed object, and its return type is the shape the
// database actually declares.
//
// Two verbs, because Foundry has two and the difference is real: an action
// "can create, modify, and delete objects in the Ontology" and is APPLIED; a
// function "executes custom logic on the data" and is EXECUTED. The generator
// decides from volatility, so nothing here has to be told.
//
// What is deliberately NOT here: Foundry's action response carries a per-
// parameter `validation` block and an `edits` summary. Ours has neither yet —
// our actions are Postgres functions that throw or return. Inventing that
// envelope would be a shape with nothing behind it.

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

declare const params: unique symbol
declare const result: unique symbol

/** An entity that may write. Applied. */
export interface ActionType<P, R> {
  apiName: string
  kind: 'action'
  readonly [params]?: P
  readonly [result]?: R
}

/** An entity that reads and returns. Executed. */
export interface FunctionType<P, R> {
  apiName: string
  kind: 'function'
  readonly [params]?: P
  readonly [result]?: R
}

/** The transport. `supabase-js` satisfies this without being imported here —
 *  the platform package has no opinion about who is calling. */
export interface Rpc {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

export interface Client {
  <P, R>(entity: ActionType<P, R>): { applyAction: (args: P) => Promise<R> }
  <P, R>(entity: FunctionType<P, R>): { executeFunction: (args: P) => Promise<R> }
}

export function createClient(transport: Rpc): Client {
  const call = async (name: string, args: unknown): Promise<unknown> => {
    const res = await transport.rpc(name, args as Record<string, unknown>)
    if (res.error) throw new Error(res.error.message)
    return res.data
  }
  // One implementation behind two names: the verb is the caller's contract, and
  // which one is available is decided by the entity's type.
  const client = (entity: { apiName: string }) => ({
    applyAction:     (args: unknown) => call(entity.apiName, args),
    executeFunction: (args: unknown) => call(entity.apiName, args),
  })
  return client as Client
}
