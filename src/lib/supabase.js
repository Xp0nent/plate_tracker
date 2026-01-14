import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tiojjlqenrpdixgmvbrr.supabase.co';
const supabaseKey = 'sb_publishable_OfrFQloA5Zikg__zb0qESg_jp0KB4EN';

export const supabase = createClient(supabaseUrl, supabaseKey);