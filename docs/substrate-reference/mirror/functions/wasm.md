<!-- source: https://supabase.com/docs/guides/functions/wasm · mirrored 2026-08-13 from Supabase docs -->

# Using Wasm modules

Use WebAssembly in Edge Functions.

How to use WebAssembly in Edge Functions.

Edge Functions supports running [WebAssembly (Wasm)](https://developer.mozilla.org/en-US/docs/WebAssembly) modules. WebAssembly is useful if you want to optimize code that's slower to run in JavaScript or require low-level manipulation.

This allows you to:

- Optimize performance-critical code beyond JavaScript capabilities
- Port existing libraries from other languages (C, C++, Rust) to JavaScript
- Access low-level system operations not available in JavaScript

For example, libraries like [magick-wasm](https://supabase.com/docs/guides/functions/examples/image-manipulation) port existing C libraries to WebAssembly for complex image processing.

***

## Writing a Wasm module

You can use different languages and SDKs to write Wasm modules. For this tutorial, we will write a basic Wasm module in Rust that adds two numbers.

Note: Follow this [guide on writing Wasm modules in Rust](https://developer.mozilla.org/en-US/docs/WebAssembly/Rust_to_Wasm) to setup your dev environment.

1. **Create a new Edge Function**

Create a new Edge Function called `wasm-add`

```bash
supabase functions new wasm-add
```

2. **Create a new Cargo project**

Create a new Cargo project for the Wasm module inside the function's directory:

```bash
cd supabase/functions/wasm-add
cargo new --lib add-wasm
```

3. **Add the Wasm module code**

Add the following code to `add-wasm/src/lib.rs`.

4. **Update the Cargo.toml file**

Update the `add-wasm/Cargo.toml` to include the `wasm-bindgen` dependency.

5. **Build the Wasm module**

Build the package by running:

```bash
wasm-pack build --target deno
```

This will produce a Wasm binary file inside `add-wasm/pkg` directory.

***

## Calling the Wasm module from the Edge Function

Update your Edge Function to call the add function from the Wasm module:



Note: Supabase Edge Functions currently use Deno 1.46. From [Deno 2.1, importing Wasm modules](https://deno.com/blog/v2.1) will require even less boilerplate code.

***

## Bundle and deploy

Before deploying, ensure the Wasm module is bundled with your function by defining it in `supabase/config.toml`:

Note: - You will need update Supabase CLI to 2.7.0 or higher for the `static_files` support.
- Static files cannot be deployed using the `--use-api` API flag. You need to build them with [Docker on the CLI](https://supabase.com/docs/guides/functions/quickstart#step-6-deploy-to-production).

```toml
[functions.wasm-add]
static_files = [ "./functions/wasm-add/add-wasm/pkg/*"]
```

Deploy the function by running:

```bash
supabase functions deploy wasm-add
```
