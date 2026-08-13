<!-- source: https://supabase.com/docs/guides/functions/examples/screenshots · mirrored 2026-08-13 from Supabase docs -->

# Taking Screenshots with Puppeteer

Take screenshots in Edge Functions with Puppeteer and Browserless.io.



[Puppeteer](https://pptr.dev/) is a handy tool to programmatically take screenshots and generate PDFs. However, trying to do so in Edge Functions can be challenging due to the size restrictions. Luckily there is a [serverless browser offering available](https://www.browserless.io/) that we can connect to via WebSockets.

Find the code on [GitHub](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/puppeteer).
