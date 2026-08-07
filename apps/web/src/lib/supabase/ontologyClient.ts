// The generated client, bound to our transport.
//
// `client(saveObjectType).applyAction({…})` — the entity is an imported value,
// so a name that does not exist is a compile error rather than a 404 at run
// time. That is what deleted `check:rpcs`: it existed to catch by regex what the
// compiler catches here.

import { createClient } from '@beacon/platform'
import { supabase } from './client'

export const client = createClient(supabase)
