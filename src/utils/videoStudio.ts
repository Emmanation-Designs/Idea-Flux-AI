import { supabase } from '../lib/supabase';

/**
 * Perform authenticated handoff from GAS1 (Trelvix AI) to GAS2 (Video Studio).
 * Retrieves the active Supabase session's access token and redirects the browser
 * in the SAME tab to https://videostudio.trelvixai.com?access_token=<access_token>
 */
export const navigateToVideoStudio = async (): Promise<void> => {
  const videoStudioBaseUrl = 'https://videostudio.trelvixai.com';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      window.location.href = `${videoStudioBaseUrl}?access_token=${encodeURIComponent(session.access_token)}`;
    } else {
      window.location.href = videoStudioBaseUrl;
    }
  } catch (err) {
    console.error('Error getting session for Video Studio handoff:', err);
    window.location.href = videoStudioBaseUrl;
  }
};
