import { Database } from './Database'
import QueryBuilder from './query_builder'
import { IQueryOptions } from './types'

export class DatabaseLayer<T = any> {
  private database: Database
  private tableName: string

  constructor(databaseName: string, tableName: string) {
    this.database = Database.instance(databaseName)
    this.tableName = tableName
  }

  async executeBulkSql(sqls: string[], params: (any[] | undefined)[] = []) {
    const paramsList = sqls.map((_, index) => params[index] ?? [])
    return this.database.runBulkSql(sqls, paramsList)
  }

  async executeSql(sql: string, params: any[] = []) {
    const [res] = await this.executeBulkSql([sql], [params])
    return res
  }

  async insert<P = any>(obj: P) {
    const sql = QueryBuilder.insert(this.tableName, obj)
    const params = Object.values(obj)
    const { insertId } = await this.executeSql(sql, params)
    return this.find(insertId)
  }

  async update<P = any>(obj: P) {
    const sql = QueryBuilder.update(this.tableName, obj)
    const { id, ...props } = obj as any
    const params = [...Object.values(props), id]
    await this.executeSql(sql, params)
    return this.find(id)
  }

  async bulkInsertOrReplace(objs) {
    const list = objs.reduce((accumulator, obj) => {
      const params = Object.values(obj)
      accumulator.sqls.push(QueryBuilder.insertOrReplace(this.tableName, obj))
      accumulator.params.push(params)
      return accumulator
    }, { sqls: [], params: [] })
    return this.executeBulkSql(list.sqls, list.params)
  }

  async destroy(id: any) {
    const sql = QueryBuilder.destroy(this.tableName)
    await this.executeSql(sql, [id])
    return true
  }

  async destroyAll() {
    const sql = QueryBuilder.destroyAll(this.tableName)
    await this.executeSql(sql)
    return true
  }

  async find(id: any) {
    const sql = QueryBuilder.find(this.tableName)
    const { rows } = await this.executeSql(sql, [id])
    return rows[0]
  }

  async findBy(where = {}) {
    const options = { where, limit: 1 }
    const sql = QueryBuilder.query(this.tableName, options)
    const params = Object.values(options.where)
      .map(option => Object.values(option))
      .flat()
    const { rows } = await this.executeSql(sql, params)
    return rows[0]
  }

  async query(options: IQueryOptions<T> = {}) {
    const sql = QueryBuilder.query(this.tableName, options)
    let params
    if (Array.isArray(options.where)) {
      params = options.where
        .map(option => Object.values(option || {}))
        .flat()
    } else {
      params = Object.values(options.where || {})
    }
    params = params
      .map(option =>
        Object.entries(option)
          .filter(([key]) => key !== 'operator')
          .map(([, values]) => values)
      )
      .flat()
      .flat()
      .flat()
      .filter(v => v !== undefined)
    const { rows } = await this.executeSql(sql, params)
    return rows
  }
}
