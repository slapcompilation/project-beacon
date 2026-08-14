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

// The edit batch. "For the edits created in a function to actually be applied,
// Ontology edit functions must be configured as a function-backed Action" — so
// this collects and nothing more. The batch never writes; it returns the
// published ObjectEdit variants and the action decides.
//
// v2 semantics, which are the ones that matter here: "Subsequent access to the
// lastName property value of employee later in the same function execution will
// NOT reflect the changes that you make when calling update on the edit batch."
// The batch is write-only, so no read path is touched and no pending-edit
// overlay is needed.
function __ref(target) {
  // Either a loaded instance or "{ $apiName, $primaryKey }" — the page prints
  // both forms and treats them the same.
  if (target === null || typeof target !== 'object') {
    throw new Error('an edit names an object instance or { $apiName, $primaryKey }')
  }
  var apiName = target.$apiName || target.apiName
  var primaryKey = target.$primaryKey
  if (!apiName) throw new Error('an edit names an object type')
  if (primaryKey === undefined || primaryKey === null) {
    throw new Error('an edit names a primary key')
  }
  return { objectType: String(apiName), primaryKey: String(primaryKey) }
}

globalThis.createEditBatch = function () {
  var edits = []
  return {
    // "you must specify a value for its primary key and can optionally
    // initialize any other properties"
    create: function (type, properties) {
      var apiName = typeof type === 'string' ? type : type.apiName
      var props = Object.assign({}, properties)
      var pk = props.$primaryKey
      delete props.$primaryKey
      if (pk === undefined || pk === null) {
        throw new Error('create needs a $primaryKey for ' + apiName)
      }
      edits.push({ addObject: { objectType: String(apiName), primaryKey: String(pk), properties: props } })
      return this
    },
    update: function (target, properties) {
      var r = __ref(target)
      edits.push({ modifyObject: { objectType: r.objectType, primaryKey: r.primaryKey, properties: properties || {} } })
      return this
    },
    delete: function (target) {
      var r = __ref(target)
      edits.push({ deleteObject: __ref(target) })
      return this
    },
    // "For many-to-many links, the link and unlink methods are available"; a
    // one-to-one or one-to-many link is edited with update on the foreign key,
    // so these two only ever describe many-to-many — which this platform has
    // no instance store for, and the action refuses them by name.
    link: function (a, linkName, b) {
      edits.push({ addLink: { linkTypeApiNameAtoB: String(linkName), aSideObject: __ref(a), bSideObject: __ref(b) } })
      return this
    },
    unlink: function (a, linkName, b) {
      edits.push({ deleteLink: { linkTypeApiNameAtoB: String(linkName), aSideObject: __ref(a), bSideObject: __ref(b) } })
      return this
    },
    getEdits: function () { return edits.slice() },
  }
}

// The result is settled INSIDE the isolate and left in a plain global. The
// host then reads a string, never a promise: __hostCall is asyncified, so a
// function that only awaits ontology reads completes as soon as the host
// drains the microtask queue, and no promise crosses the boundary.
// "you may want to throw an error with a detailed message. To do so, throw a
// UserFacingError" (functions/python-user-facing-error). The distinction is
// the author's, not the platform's, and the action reports the two differently
// — "User-facing function failure: The function backing the action threw an
// error intended to be displayed to the user" is a separate failure type from
// a function that merely broke.
globalThis.UserFacingError = function UserFacingError(message) {
  var e = new Error(message)
  e.name = 'UserFacingError'
  e.__userFacing = true
  return e
}
globalThis.UserFacingError.prototype = Object.create(Error.prototype)

globalThis.__state = { done: false, value: null, error: null, userFacing: false }

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
        // Thrown with or without new, both arrive here; the flag is what
        // the host branches on. (No backticks in this comment: the whole
        // harness lives inside a String.raw template and one would end it.)
        userFacing: !!(e && (e.__userFacing || e.name === 'UserFacingError')),
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
