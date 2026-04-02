/**
 * Generic typed repository interface.
 * Each entity domain will have a concrete repository that implements
 * these patterns — e.g. IProductRepository, IStockLogRepository, etc.
 *
 * All queries are automatically scoped to the authenticated user's hotel_id
 * via RLS at the database layer. hotelId params are for explicit typing only.
 */

export interface IRepository<T, CreateInput, UpdateInput = Partial<CreateInput>> {
  findAll(): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateInput): Promise<T>
  update(id: string, data: UpdateInput): Promise<T>
  delete(id: string): Promise<void>
}
