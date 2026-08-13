<!-- source: https://supabase.com/docs/guides/functions/quickstart-dashboard · mirrored 2026-08-13 from Supabase docs -->

# Getting Started with Edge Functions (Dashboard)

Learn how to create, test, and deploy your first Edge Function using the Supabase Dashboard.

Get started with Supabase Edge Functions.

Supabase allows you to create Supabase Edge Functions directly from the Supabase Dashboard, making it easy to deploy functions without needing to set up a local development environment. The Edge Functions editor in the Dashboard has built-in syntax highlighting and type-checking for Deno and Supabase-specific APIs.

This guide will walk you through creating, testing, and deploying your first Edge Function using the Supabase Dashboard. You'll have a working function running globally in under 10 minutes.

Note: You can also create and deploy functions using the Supabase CLI. Check out our [CLI Quickstart guide](https://supabase.com/docs/guides/functions/quickstart).

Note: You'll need a Supabase project to get started. If you don't have one yet, create a new project at [database.new](https://database.new/).

***

## Step 1: Navigate to the Edge Functions tab

Navigate to your Supabase project dashboard and locate the Edge Functions section:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. In the left sidebar, click on **Edge Functions**

You'll see the Edge Functions overview page where you can manage all your functions.

***

## Step 2: Create your first function

Click the **"Deploy a new function"** button and select **"Via Editor"** to create a function directly in the dashboard.

![Scaffold functions through the dashboard editor](https://supabase.com/docs/img/guides/functions/dashboard/create-edge-function--dark.png)

Note: The dashboard offers several pre-built templates for common use cases, such as Stripe Webhooks, OpenAI proxying, uploading files to Supabase Storage, and sending emails.

For this guide, we’ll select the **"Hello World"** template. If you’d rather start from scratch, you can ignore the pre-built templates.

***

## Step 3: Customize your function code

The dashboard will load your chosen template in the code editor. Here's what the "Hello World" template looks like:

![Hello World template](https://supabase.com/docs/img/guides/functions/dashboard/edge-function-template--dark.png)

If needed, you can modify this code directly in the browser editor. The function accepts a JSON payload with a `name` field and returns a greeting message.

***

## Step 4: Deploy your function

Once you're happy with your function code:

1. Click the **"Deploy function"** button at the bottom of the editor
2. Wait for the deployment to complete (usually takes 10-30 seconds)
3. You'll see a success message when deployment is finished

🚀 Your function is now automatically distributed to edge locations worldwide, running at `https://YOUR_PROJECT_ID.supabase.co/functions/v1/hello-world`

***

## Step 5: Test your function

Supabase has built-in tools for testing your Edge Functions from the Dashboard. You can execute your Edge Function with different request payloads, headers, and query parameters. The built-in tester returns the response status, headers, and body.

On your function's details page:

1. Click the **"Test"** button
2. Configure your test request:
   - **HTTP Method**: POST (or whatever your function expects)
   - **Headers**: Add any required headers like `Content-Type: application/json`
   - **Query Parameters**: Add URL parameters if needed
   - **Request Body**: Add your JSON payload
   - **Authorization**: Change the authorization token (anon key or user key)

Click **"Send Request"** to test your function.

![Test your function](https://supabase.com/docs/img/guides/functions/dashboard/edge-function-test--dark.png)

In this example, we successfully tested our Hello World function by sending a JSON payload with a name field, and received the expected greeting message back.

***

## Step 6: Get your function URL and keys

Your function is now live at:

```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/hello-world
```

To invoke this Edge Function from within your application, you'll need API keys. Navigate to **Settings > API Keys** in your dashboard to find:

- **Publishable Keys** - For client-side requests (safe to use in browsers with RLS enabled)
- **Secret Keys** - For server-side requests (keep this secret! bypasses RLS)

***

If you’d like to update the deployed function code, click on the function you want to edit, modify the code as needed, then click Deploy updates. This will overwrite the existing deployment with the newly edited function code.

Caution: There is currently **no version control** for edits! The Dashboard's Edge Function editor currently does not support version control, versioning, or rollbacks. We recommend using it only for quick testing and prototypes.

***

## Usage

Now that your function is deployed, you can invoke it from within your app:

Note: Make sure your function can handle [CORS](https://supabase.com/docs/guides/functions/cors) (Cross-Origin Resource Sharing) requests by configuring its headers correctly.

**Supabase Client**

```jsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://[YOUR_PROJECT_ID].supabase.co', 'YOUR_PUBLISHABLE_KEY')

const { data, error } = await supabase.functions.invoke('hello-world', {
  body: { name: 'JavaScript' },
})

console.log(data) // { message: "Hello JavaScript!" }
```

**Fetch API**

```jsx
const response = await fetch('https://[YOUR_PROJECT_ID].supabase.co/functions/v1/hello-world', {
  method: 'POST',
  headers: {
    apikey: '<SUPABASE_PUBLISHABLE_KEY>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'Fetch' }),
})

const data = await response.json()
console.log(data) // { message: "Hello there!" }
```

***

## Deploy via Assistant

You can also use Supabase's AI Assistant to generate and deploy functions automatically.

Go to your project > **Deploy a new function** > **Via AI Assistant**.

![Create Edge Function via AI Assistant](https://supabase.com/docs/img/guides/functions/dashboard/create-ai-edge-function--dark.png)

Describe what you want your function to do in the prompt

![Create Edge Function via AI Assistant](https://supabase.com/docs/img/guides/functions/dashboard/ai-edge-function--dark.png)

Click **Deploy** and the Assistant will create and deploy the function for you.

***

## Download Edge Functions

Now that your function is deployed, you can access it from your local development environment. To use your Edge Function code within your local development environment, you can download your function source code either through the dashboard, or the CLI.

### Dashboard

1. Go to your function's page
2. In the top right corner, click the **"Download"** button

### CLI

Note: Before getting started, make sure you have the **Supabase CLI installed**. Check out the [CLI installation guide](https://supabase.com/docs/guides/local-development) for installation methods and troubleshooting.

```bash
# Link your project to your local environment
supabase link --project-ref [project-ref]

# List all functions in the linked project
supabase functions list

# Download a function
supabase functions download hello-world
```

At this point, your function has been downloaded to your local environment. Make the required changes, and redeploy when you're ready.

```bash
# Run a function locally
supabase functions serve hello-world

# Redeploy when you're ready with your changes
supabase functions deploy hello-world
```
