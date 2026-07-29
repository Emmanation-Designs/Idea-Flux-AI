import { supabase } from './supabase';
import type { MediaFileItem, MediaType, LibrarySection } from '../types';

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function detectMediaType(mimeType?: string, fileName?: string): MediaType {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();

  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|flv)$/i.test(name)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) return 'audio';
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('word') || mime.includes('text') || /\.(pdf|doc|docx|txt|rtf|md|csv|xlsx|pptx)$/i.test(name)) return 'document';
  return 'other';
}

function extractFileExtension(fileName?: string): string {
  if (!fileName) return 'FILE';
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : 'FILE';
}

/**
 * Main service to fetch real user library items from Supabase tables & Storage buckets.
 */
export async function fetchLibraryItems(): Promise<{
  uploaded: MediaFileItem[];
  generated: MediaFileItem[];
}> {
  const uploadedItems: MediaFileItem[] = [];
  const generatedItems: MediaFileItem[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    // 1. FETCH FROM user_uploads TABLE
    if (userId) {
      try {
        const { data: uploads, error: uploadErr } = await supabase
          .from('user_uploads')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!uploadErr && Array.isArray(uploads)) {
          uploads.forEach((row: any) => {
            if (seenIds.has(row.id)) return;
            seenIds.add(row.id);
            if (row.file_url) seenUrls.add(row.file_url);

            const item: MediaFileItem = {
              id: row.id,
              name: row.file_name || 'Uploaded File',
              type: row.file_type || detectMediaType(row.mime_type, row.file_name),
              category: row.category || 'uploaded',
              createdAt: row.created_at || new Date().toISOString(),
              size: typeof row.file_size === 'number' ? formatBytes(row.file_size) : (row.file_size || 'N/A'),
              url: row.file_url || row.file_path,
              thumbnailUrl: row.thumbnail_url || (row.file_type === 'image' ? (row.file_url || row.file_path) : undefined),
              fileFormat: row.file_format || extractFileExtension(row.file_name),
              originatingFeature: row.originating_feature || 'Chat Upload',
              mimeType: row.mime_type,
              filePath: row.file_path,
              prompt: row.prompt,
              modelUsed: row.model_used
            };

            if (item.category === 'generated') {
              generatedItems.push(item);
            } else {
              uploadedItems.push(item);
            }
          });
        }
      } catch (e) {
        console.warn('user_uploads table not found or query error:', e);
      }

      // 2. FETCH FROM organization_files TABLE
      try {
        const { data: orgFiles, error: orgErr } = await supabase
          .from('organization_files')
          .select('*')
          .eq('uploaded_by', userId)
          .order('created_at', { ascending: false });

        if (!orgErr && Array.isArray(orgFiles)) {
          orgFiles.forEach((row: any) => {
            if (seenIds.has(row.id) || (row.file_path && seenUrls.has(row.file_path))) return;
            seenIds.add(row.id);
            if (row.file_path) seenUrls.add(row.file_path);

            uploadedItems.push({
              id: row.id,
              name: row.file_name || 'Organization File',
              type: detectMediaType(row.mime_type, row.file_name),
              category: 'uploaded',
              createdAt: row.created_at || new Date().toISOString(),
              size: formatBytes(row.file_size),
              url: row.file_path,
              fileFormat: extractFileExtension(row.file_name),
              originatingFeature: 'Workspace',
              mimeType: row.mime_type,
              filePath: row.file_path
            });
          });
        }
      } catch (e) {
        console.warn('organization_files query error:', e);
      }

      // 3. FETCH FROM images TABLE (AI Generated Images)
      try {
        const { data: images, error: imgErr } = await supabase
          .from('images')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!imgErr && Array.isArray(images)) {
          images.forEach((row: any) => {
            if (seenIds.has(row.id) || (row.image_url && seenUrls.has(row.image_url))) return;
            seenIds.add(row.id);
            if (row.image_url) seenUrls.add(row.image_url);

            const promptTitle = row.prompt ? (row.prompt.length > 50 ? row.prompt.slice(0, 50) + '...' : row.prompt) : 'AI Generated Image';

            generatedItems.push({
              id: row.id,
              name: promptTitle,
              type: 'image',
              category: 'generated',
              createdAt: row.created_at || new Date().toISOString(),
              url: row.image_url,
              thumbnailUrl: row.image_url,
              fileFormat: 'PNG',
              prompt: row.prompt,
              modelUsed: row.model || 'Imagen 3',
              originatingFeature: 'Image Studio',
              generatorType: 'AI Image'
            });
          });
        }
      } catch (e) {
        console.warn('images query error:', e);
      }

      // 4. FETCH FROM tts_generations TABLE (AI Voice & Speech)
      try {
        const { data: ttsList, error: ttsErr } = await supabase
          .from('tts_generations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!ttsErr && Array.isArray(ttsList)) {
          ttsList.forEach((row: any) => {
            if (seenIds.has(row.id)) return;
            seenIds.add(row.id);

            const meta = row.metadata || {};
            const textContent = meta.text_snippet || meta.original_text || 'TTS Voice Generation';
            const name = textContent.length > 50 ? textContent.slice(0, 50) + '...' : textContent;
            const audioUrl = meta.audio_url || (meta.audio_base64 ? `data:audio/mp3;base64,${meta.audio_base64}` : undefined);

            generatedItems.push({
              id: row.id,
              name: name,
              type: 'speech',
              category: 'generated',
              createdAt: row.created_at || new Date().toISOString(),
              size: formatBytes(row.file_size_bytes),
              duration: row.audio_duration_seconds ? `${row.audio_duration_seconds}s` : undefined,
              url: audioUrl,
              fileFormat: 'MP3',
              prompt: meta.original_text || textContent,
              modelUsed: meta.voice_name || row.selected_model || row.selected_voice || 'Trelvix Voice',
              originatingFeature: 'Text to Speech',
              generatorType: 'AI Voice'
            });
          });
        }
      } catch (e) {
        console.warn('tts_generations query error:', e);
      }

      // 5. FETCH FROM video_generations TABLE (AI Video Studio)
      try {
        const { data: videos, error: vidErr } = await supabase
          .from('video_generations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!vidErr && Array.isArray(videos)) {
          videos.forEach((row: any) => {
            if (seenIds.has(row.id) || (row.video_url && seenUrls.has(row.video_url))) return;
            seenIds.add(row.id);
            if (row.video_url) seenUrls.add(row.video_url);

            const promptTitle = row.prompt ? (row.prompt.length > 50 ? row.prompt.slice(0, 50) + '...' : row.prompt) : 'AI Generated Video';

            generatedItems.push({
              id: row.id,
              name: promptTitle,
              type: 'video',
              category: 'generated',
              createdAt: row.created_at || new Date().toISOString(),
              url: row.video_url,
              duration: row.duration || '10s',
              resolution: row.resolution || '1080p',
              fileFormat: 'MP4',
              prompt: row.prompt,
              modelUsed: row.selected_model || 'Trelvix Video',
              originatingFeature: 'Video Studio',
              generatorType: 'AI Video'
            });
          });
        }
      } catch (e) {
        console.warn('video_generations query error:', e);
      }
    }
  } catch (err) {
    console.error('Failed fetching library items from Supabase:', err);
  }

  // 6. Local Storage Fallback / Integration for offline uploads
  try {
    const localData = localStorage.getItem('trelvix_library_files');
    if (localData) {
      const parsed: MediaFileItem[] = JSON.parse(localData);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (!seenIds.has(item.id) && !(item.url && seenUrls.has(item.url))) {
            seenIds.add(item.id);
            if (item.url) seenUrls.add(item.url);
            if (item.category === 'generated') {
              generatedItems.push(item);
            } else {
              uploadedItems.push(item);
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn('LocalStorage library fallback error:', e);
  }

  return { uploaded: uploadedItems, generated: generatedItems };
}

/**
 * Upload a user file and save record to Supabase user_uploads table
 */
export async function uploadLibraryFile(file: File, originatingFeature: string = 'Upload'): Promise<MediaFileItem> {
  const fileType = detectMediaType(file.type, file.name);
  const sizeMb = formatBytes(file.size);
  const fileFormat = extractFileExtension(file.name);

  // Read preview / data URL
  const fileUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  const newItem: MediaFileItem = {
    id: `upl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: file.name,
    type: fileType,
    category: 'uploaded',
    createdAt: new Date().toISOString(),
    size: sizeMb,
    url: fileUrl,
    thumbnailUrl: fileType === 'image' ? fileUrl : undefined,
    fileFormat: fileFormat,
    originatingFeature: originatingFeature,
    mimeType: file.type
  };

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('user_uploads')
        .insert({
          user_id: userId,
          file_name: file.name,
          file_type: fileType,
          category: 'uploaded',
          file_size: file.size,
          mime_type: file.type,
          file_url: fileUrl,
          file_format: fileFormat,
          originating_feature: originatingFeature
        })
        .select()
        .single();

      if (!error && data) {
        newItem.id = data.id;
      }
    } catch (err) {
      console.warn('Notice saving to user_uploads table:', err);
    }
  }

  // Also persist locally for current browser session
  saveLocalLibraryItem(newItem);

  return newItem;
}

/**
 * Delete a file from Supabase and local storage
 */
export async function deleteLibraryItem(item: MediaFileItem): Promise<boolean> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (userId) {
    try {
      if (item.category === 'uploaded') {
        await supabase.from('user_uploads').delete().eq('id', item.id).eq('user_id', userId);
        await supabase.from('organization_files').delete().eq('id', item.id).eq('uploaded_by', userId);
      } else {
        if (item.type === 'image') {
          await supabase.from('images').delete().eq('id', item.id).eq('user_id', userId);
        } else if (item.type === 'speech' || item.type === 'audio') {
          await supabase.from('tts_generations').delete().eq('id', item.id).eq('user_id', userId);
        } else if (item.type === 'video') {
          await supabase.from('video_generations').delete().eq('id', item.id).eq('user_id', userId);
        }
        await supabase.from('user_uploads').delete().eq('id', item.id).eq('user_id', userId);
      }
    } catch (err) {
      console.warn('Error deleting item from Supabase:', err);
    }
  }

  // Remove from LocalStorage cache
  try {
    const localData = localStorage.getItem('trelvix_library_files');
    if (localData) {
      const parsed: MediaFileItem[] = JSON.parse(localData);
      const filtered = parsed.filter(i => i.id !== item.id);
      localStorage.setItem('trelvix_library_files', JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('LocalStorage delete error:', e);
  }

  return true;
}

/**
 * Rename an item in Supabase and local storage
 */
export async function renameLibraryItem(item: MediaFileItem, newName: string): Promise<boolean> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (userId) {
    try {
      await supabase
        .from('user_uploads')
        .update({ file_name: newName })
        .eq('id', item.id)
        .eq('user_id', userId);

      await supabase
        .from('organization_files')
        .update({ file_name: newName })
        .eq('id', item.id)
        .eq('uploaded_by', userId);

      if (item.category === 'generated') {
        if (item.type === 'image') {
          await supabase.from('images').update({ prompt: newName }).eq('id', item.id).eq('user_id', userId);
        } else if (item.type === 'video') {
          await supabase.from('video_generations').update({ prompt: newName }).eq('id', item.id).eq('user_id', userId);
        }
      }
    } catch (err) {
      console.warn('Error updating file name in Supabase:', err);
    }
  }

  // Update in LocalStorage cache
  try {
    const localData = localStorage.getItem('trelvix_library_files');
    if (localData) {
      const parsed: MediaFileItem[] = JSON.parse(localData);
      const updated = parsed.map(i => i.id === item.id ? { ...i, name: newName } : i);
      localStorage.setItem('trelvix_library_files', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('LocalStorage rename error:', e);
  }

  return true;
}

/**
 * Duplicate a library item
 */
export async function duplicateLibraryItem(item: MediaFileItem): Promise<MediaFileItem> {
  const duplicatedItem: MediaFileItem = {
    ...item,
    id: `dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: `Copy of ${item.name}`,
    createdAt: new Date().toISOString()
  };

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (userId) {
    try {
      const { data } = await supabase
        .from('user_uploads')
        .insert({
          user_id: userId,
          file_name: duplicatedItem.name,
          file_type: duplicatedItem.type,
          category: duplicatedItem.category,
          file_url: duplicatedItem.url,
          file_format: duplicatedItem.fileFormat,
          originating_feature: duplicatedItem.originatingFeature,
          prompt: duplicatedItem.prompt,
          model_used: duplicatedItem.modelUsed
        })
        .select()
        .single();

      if (data) {
        duplicatedItem.id = data.id;
      }
    } catch (err) {
      console.warn('Error duplicating item in Supabase:', err);
    }
  }

  saveLocalLibraryItem(duplicatedItem);
  return duplicatedItem;
}

function saveLocalLibraryItem(item: MediaFileItem) {
  try {
    const localData = localStorage.getItem('trelvix_library_files');
    const existing: MediaFileItem[] = localData ? JSON.parse(localData) : [];
    const updated = [item, ...existing.filter(i => i.id !== item.id)];
    localStorage.setItem('trelvix_library_files', JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}
