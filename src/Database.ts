import * as SQLite from 'expo-sqlite'
import type { SQLiteDatabase } from 'expo-sqlite'

export class Database {
  private databaseName: string
  private databasePromise: Promise<SQLiteDatabase> | null = null
  private static instances: Record<string, Database> = {}

  private constructor(databaseName: string) {
    this.databaseName = databaseName
  }

  private async getDatabase(): Promise<SQLiteDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = SQLite.openDatabaseAsync(this.databaseName)
    }
    return this.databasePromise
  }

  static instance(databaseName: string): Database {
    if (!this.instances[databaseName]) {
      this.instances[databaseName] = new Database(databaseName)
    }
    return this.instances[databaseName]
  }

  async withTransactionAsync<T>(fn: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
    const db = await this.getDatabase()
    let result: T | undefined
    await db.withTransactionAsync(async () => {
      result = await fn(db)
    })
    if (result === undefined) {
      throw new Error('Transaction callback did not return a value')
    }
    return result
  }

  async runSql(
    sql: string,
    params: any[] = []
  ): Promise<{ rows: any[]; insertId: number | null }> {
    const db = await this.getDatabase()
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT')
    if (isSelect) {
      const rows = await db.getAllAsync(sql, params)
      return { rows, insertId: null }
    }
    const result = await db.runAsync(sql, params)
    return { rows: [], insertId: result.lastInsertRowId }
  }

  async runBulkSql(
    sqls: string[],
    paramsList: any[][]
  ): Promise<Array<{ rows: any[]; insertId: number | null }>> {
    const db = await this.getDatabase()
    const results: Array<{ rows: any[]; insertId: number | null }> = []
    await db.withTransactionAsync(async () => {
      for (let i = 0; i < sqls.length; i++) {
        const sql = sqls[i]
        const params = paramsList[i] ?? []
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT')
        if (isSelect) {
          const rows = await db.getAllAsync(sql, params)
          results.push({ rows, insertId: null })
        } else {
          const result = await db.runAsync(sql, params)
          results.push({ rows: [], insertId: result.lastInsertRowId })
        }
      }
    })
    return results
  }

  async close(): Promise<void> {
    if (!this.databasePromise) return
    const db = await this.databasePromise
    await db.closeAsync()
    this.databasePromise = null
    delete Database.instances[this.databaseName]
  }

  async reset(): Promise<void> {
    if (this.databasePromise) {
      const db = await this.databasePromise
      await db.closeAsync()
      await SQLite.deleteDatabaseAsync(this.databaseName)
      this.databasePromise = null
      delete Database.instances[this.databaseName]
    }
  }
}
