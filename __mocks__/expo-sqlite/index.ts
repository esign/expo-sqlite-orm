export const mockDb = {
  getAllAsync: jest.fn(async () => []),
  runAsync: jest.fn(async (sql: string) => ({
    lastInsertRowId: /^INSERT/i.test(sql) ? 1 : null,
    changes: 1
  })),
  closeAsync: jest.fn(async () => {}),
  withExclusiveTransactionAsync: jest.fn(async (fn: (db: typeof mockDb) => Promise<any>) =>
    fn(mockDb)
  )
}
mockDb.withTransactionAsync = jest.fn(async (fn: (db: typeof mockDb) => Promise<any>) =>
  fn(mockDb)
)

export const openDatabaseAsync = jest.fn(async () => mockDb)
export const deleteDatabaseAsync = jest.fn(async () => {})
