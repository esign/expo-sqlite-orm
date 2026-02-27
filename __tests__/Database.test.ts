import { deleteDatabaseAsync, mockDb } from 'expo-sqlite'
import { Database } from '../src/Database'

jest.mock('expo-sqlite')

describe('Database', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDb.getAllAsync.mockResolvedValue([])
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 })
  })

  it('reset closes database and deletes file', async () => {
    const db = Database.instance('reset-test')
    await db.runSql('SELECT 1')
    await db.reset()
    expect(mockDb.closeAsync).toHaveBeenCalled()
    expect(deleteDatabaseAsync).toHaveBeenCalledWith('reset-test')
  })

  describe('withTransactionAsync', () => {
    it('executes callback within transaction and returns result', async () => {
      const db = Database.instance('transaction-test')
      const result = await db.withTransactionAsync(async (txnDb) => {
        await txnDb.runAsync('INSERT INTO test VALUES (?)', ['value'])
        return { success: true }
      })
      expect(result).toEqual({ success: true })
      expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1)
    })

    it('throws error if callback does not return a value', async () => {
      const db = Database.instance('transaction-error-test')
      mockDb.withTransactionAsync.mockImplementationOnce(async (fn) => {
        await fn(mockDb)
      })
      await expect(
        db.withTransactionAsync(async () => {
          await mockDb.runAsync('SELECT 1')
        })
      ).rejects.toThrow('Transaction callback did not return a value')
    })

    it('propagates errors from transaction callback', async () => {
      const db = Database.instance('transaction-error-test')
      const error = new Error('Transaction failed')
      mockDb.withTransactionAsync.mockImplementationOnce(async (fn) => {
        throw error
      })
      await expect(
        db.withTransactionAsync(async () => {
          return { success: true }
        })
      ).rejects.toThrow('Transaction failed')
    })
  })
})
