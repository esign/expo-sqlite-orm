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

  it('reset waits for in-flight operations before deleting', async () => {
    const db = Database.instance('reset-in-flight-test')
    let releaseRun: (() => void) | null = null

    mockDb.runAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseRun = () => resolve({ lastInsertRowId: 1, changes: 1 })
        })
    )

    const writePromise = db.runSql('INSERT INTO test VALUES (?)', ['value'])
    while (mockDb.runAsync.mock.calls.length === 0) {
      await Promise.resolve()
    }
    const resetPromise = db.reset()

    expect(mockDb.closeAsync).not.toHaveBeenCalled()
    if (!releaseRun) throw new Error('Expected runAsync resolver to be set')
    releaseRun()

    await writePromise
    await resetPromise

    expect(mockDb.closeAsync).toHaveBeenCalledTimes(1)
    expect(deleteDatabaseAsync).toHaveBeenCalledWith('reset-in-flight-test')
  })

  describe('query queueing', () => {
    it('runs concurrent runSql calls sequentially', async () => {
      const db = Database.instance('queue-test')
      const executionOrder: string[] = []
      let releaseFirstRun: (() => void) | null = null

      mockDb.runAsync.mockImplementation((sql: string) => {
        executionOrder.push(`start:${sql}`)
        if (sql === 'INSERT 1') {
          return new Promise((resolve) => {
            releaseFirstRun = () => {
              executionOrder.push(`end:${sql}`)
              resolve({ lastInsertRowId: 1, changes: 1 })
            }
          })
        }
        executionOrder.push(`end:${sql}`)
        return Promise.resolve({ lastInsertRowId: 2, changes: 1 })
      })

      const firstQueryPromise = db.runSql('INSERT 1')
      const secondQueryPromise = db.runSql('INSERT 2')

      while (mockDb.runAsync.mock.calls.length === 0) {
        await Promise.resolve()
      }

      expect(mockDb.runAsync).toHaveBeenCalledTimes(1)
      expect(executionOrder).toEqual(['start:INSERT 1'])

      if (!releaseFirstRun) throw new Error('Expected first query resolver to be set')
      releaseFirstRun()

      await firstQueryPromise
      await secondQueryPromise

      expect(mockDb.runAsync).toHaveBeenCalledTimes(2)
      expect(executionOrder).toEqual([
        'start:INSERT 1',
        'end:INSERT 1',
        'start:INSERT 2',
        'end:INSERT 2',
      ])
    })
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
      mockDb.withTransactionAsync.mockImplementationOnce(async () => {
        throw error
      })
      await expect(
        db.withTransactionAsync(async () => {
          return { success: true }
        })
      ).rejects.toThrow('Transaction failed')
    })
  })

  describe('runBulkSql', () => {
    it('runs bulk statements using regular transaction only', async () => {
      const db = Database.instance('bulk-test')
      await db.runBulkSql(
        ['INSERT INTO test VALUES (?)', 'SELECT 1'],
        [['value'], []]
      )

      expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1)
      expect(mockDb.withExclusiveTransactionAsync).not.toHaveBeenCalled()
    })
  })
})
