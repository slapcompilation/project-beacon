// The guest harness: the JavaScript that runs INSIDE the QuickJS isolate,
// alongside the published function's own source.
//
// The isolate is a WebAssembly module. It has linear memory and no ambient
// anything — no fetch, no Deno, no host globalThis — so the only way out is
// `__hostCall`, the single asyncified function the host injects. Everything
// below is built on top of that one capability.
//
// The client's shape is the documented TypeScript v2 one:
//   client(Aircraft).where({ timeUntilNextFlight: { $gt: n } })
//     .aggregate({ $select: { $count: "unordered" } })   → { $count }
//   client(Employee).fetchOne(1)
// (query-functions.md and edits-overview.md print exactly these.)

export const GUEST_HARNESS = String.raw`
globalThis.__ontology = {}

function __call(op, payload) {
  // __hostCall is asyncified: it returns a JSON string, and the host has
  // already performed the read with the CALLER's credentials.
  const raw = __hostCall(JSON.stringify({ op: op, payload: payload }))
  const res = JSON.parse(raw)
  if (!res.ok) throw new Error(res.error)
  return res.value
}

function __objectSet(apiName, where) {
  return {
    where: function (more) {
      return __objectSet(apiName, Object.assign({}, where, more))
    },
    aggregate: function (spec) {
      // "$select: { $count: 'unordered' }" is the documented count shape.
      const n = __call('count', { objectType: apiName, where: where })
      return { $count: n }
    },
    fetchPage: function (opts) {
      const rows = __call('page', {
        objectType: apiName, where: where,
        pageSize: (opts && opts.$pageSize) || 100,
      })
      return { data: rows, nextPageToken: undefined }
    },
    fetchOne: function (primaryKey) {
      return __call('fetchOne', { objectType: apiName, primaryKey: primaryKey })
    },
  }
}

globalThis.client = function (entity) {
  const apiName = typeof entity === 'string' ? entity : entity.apiName
  return __objectSet(apiName, {})
}

// The result is settled INSIDE the isolate and left in a plain global. The
// host then reads a string, never a promise: __hostCall is asyncified, so a
// function that only awaits ontology reads completes as soon as the host
// drains the microtask queue, and no promise crosses the boundary.
globalThis.__state = { done: false, value: null, error: null }

globalThis.__start = function (args) {
  Promise.resolve(globalThis.__invoke(args)).then(
    function (v) {
      globalThis.__state = {
        done: true, value: JSON.stringify(v === undefined ? null : v), error: null,
      }
    },
    function (e) {
      globalThis.__state = {
        done: true, value: null, error: String((e && e.message) || e),
      }
    },
  )
}

globalThis.__invoke = function (args) {
  // "The TypeScript function must be the default export of your file."
  // QuickJS evaluates a script, not a module, so the published source has its
  // default export rewritten to this binding before evaluation.
  if (typeof globalThis.__default !== 'function') {
    throw new Error('a function must be the default export of its file')
  }
  // "client as the first parameter, then the declared inputs" — the shape
  // query-functions.md prints for TypeScript v2.
  return globalThis.__default.apply(null, [globalThis.client].concat(args))
}
`
