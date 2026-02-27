import { deleteDatabaseAsync, mockDb } from 'expo-sqlite'
import { Database } from '../src/Database'

jest.mock('expo-sqlite')

describe('Database', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reset closes database and deletes file', async () => {
    const db = Database.instance('reset-test')
    await db.runSql('SELECT 1')
    await db.reset()
    expect(mockDb.closeAsync).toHaveBeenCalled()
    expect(deleteDatabaseAsync).toHaveBeenCalledWith('reset-test')
  })
})
