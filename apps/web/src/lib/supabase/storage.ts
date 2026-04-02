import type { IStorageService } from '@beacon/services'
import { supabase } from './client'

export class SupabaseStorageService implements IStorageService {
  async upload(bucket: string, path: string, file: File): Promise<string> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
    })
    if (error) throw new Error(error.message)
    return this.getPublicUrl(bucket, path)
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  async remove(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) throw new Error(error.message)
  }
}
