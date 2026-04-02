export interface IStorageService {
  upload(bucket: string, path: string, file: File): Promise<string>
  getPublicUrl(bucket: string, path: string): string
  remove(bucket: string, path: string): Promise<void>
}
