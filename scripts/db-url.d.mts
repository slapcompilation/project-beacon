// db-url.mjs is plain JS because the migration runner is plain node. This is its
// shape for the TypeScript side, so there is still one definition of "how do I
// connect" rather than two.
export declare function connectionString(): string | null
export declare const SSL: { rejectUnauthorized: boolean }
