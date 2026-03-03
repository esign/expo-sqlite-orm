jest.mock('../src/query_builder', () => {
  const methods = [
    'insert',
    'find',
    'query',
    'update',
    'insertOrReplace',
    'destroy',
    'destroyAll'
  ]
  return methods.reduce((o, p) => {
    if (p === 'insertOrReplace') {
      o[p] = jest.fn((tableName, options) => `query ${tableName} (${Object.keys(options)})`)
    } else {
      o[p] = jest.fn(() => 'query')
    }
    return o
  }, {})
})

import { mockDb } from 'expo-sqlite'
import { DatabaseLayer } from '../src/DatabaseLayer'
import Qb from '../src/query_builder'
import { IQueryOptions } from '../src/types'

interface ITests {
  id: number
  teste1: string
  teste2: number
  teste3: string
}

const databaseName = 'databaseName'
const tableName = 'tests'

describe('execute sql', () => {
  const databaseLayer = new DatabaseLayer<ITests>(databaseName, tableName)
  beforeEach(() => {
    jest.clearAllMocks()
    mockDb.getAllAsync.mockResolvedValue([])
    mockDb.runAsync.mockImplementation(async (sql: string) => ({
      lastInsertRowId: /^INSERT/i.test(sql) ? 1 : null,
      changes: 1
    }))
  })

  it('call execute with the correct params', () => {
    const sql = 'select * from tests where id = ?'
    const params = [1]
    return databaseLayer.executeSql(sql, params).then(() => {
      expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1)
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(sql, params)
    })
  })

  it('promise returns the expected values', () => {
    return databaseLayer.executeSql('').then(res => {
      expect(res.rows).toEqual([])
      expect(res.insertId).toBeNull()
    })
  })

  it('promise returns insertId if is an insert operation', () => {
    return databaseLayer.executeSql('INSERT INTO TEST (test) VALUES (1)').then(res => {
      expect(res.rows).toEqual([])
      expect(res.insertId).toBe(1)
    })
  })

  it('promise rejects', () => {
    jest.spyOn(databaseLayer['database'], 'runSql').mockImplementationOnce(jest.fn(async () => { throw 'Ops' }))
    return databaseLayer.executeSql('INSERT INTO TEST (test) VALUES (1)').catch(e => {
      expect(e).toEqual('Ops')
    })
  })

  it('does not use bulk execution for single statement', async () => {
    const bulkSpy = jest.spyOn(databaseLayer, 'executeBulkSql')
    const runSqlSpy = jest.spyOn(databaseLayer['database'], 'runSql')
    await databaseLayer.executeSql('SELECT * FROM tests WHERE id = ?', [1])
    expect(runSqlSpy).toHaveBeenCalledWith('SELECT * FROM tests WHERE id = ?', [1])
    expect(bulkSpy).not.toHaveBeenCalled()
  })
})

describe('run statements', () => {
  const qbMockReturns = 'query'
  const databaseLayer = new DatabaseLayer<ITests>(databaseName, tableName)
  const fn = jest.fn(() => Promise.resolve({ rows: [], insertId: null }))
  databaseLayer.executeSql = fn
  beforeEach(jest.clearAllMocks)

  it('insert', () => {
    const insertFn = jest.fn(async () => ({ rows: [{ id: 1, teste3: '{"prop":123}' }], insertId: 1 }))
    databaseLayer.executeSql = insertFn
    const resource = { teste1: 'teste', teste2: 2, teste3: JSON.stringify({ prop: 123 }) }
    return databaseLayer.insert(resource).then(res => {
      expect(Qb.insert).toBeCalledWith(tableName, resource)
      expect(insertFn).toBeCalledWith(
        qbMockReturns,
        Object.values({ ...resource, teste3: '{"prop":123}' })
      )
      expect(res).toEqual({ id: 1, teste3: '{"prop":123}' })
    })
  })

  it('update', () => {
    const updatedRow = { id: 1, teste1: 'teste', teste2: 2, teste3: '{"prop":123}' }
    const updateFn = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [updatedRow], insertId: null })
    databaseLayer.executeSql = updateFn
    const resource = { id: 1, teste1: 'teste', teste2: 2, teste3: '{"prop":123}' }
    return databaseLayer.update(resource).then((res) => {
      expect(Qb.update).toBeCalledWith(tableName, resource)
      expect(updateFn).toBeCalledWith(qbMockReturns, ['teste', 2, '{"prop":123}', 1])
      expect(res).toEqual(updatedRow)
    })
  })

  it('bulkInsertOrReplace', () => {
    jest.spyOn(databaseLayer, 'executeBulkSql').mockImplementationOnce(async (p1, p2) => ([p1, p2]))
    const objs = [{ id: 1, name: 'Daniel' }, { id: 2, name: 'Fernando' }, { id: 10, name: 'Lourusso' }]
    const expectedResponse = [
      [
        'query tests (id,name)',
        'query tests (id,name)',
        'query tests (id,name)'
      ],
      [[1, 'Daniel'], [2, 'Fernando'], [10, 'Lourusso']]
    ]
    return databaseLayer.bulkInsertOrReplace(objs).then(res => {
      expect(Qb.insertOrReplace).toHaveBeenNthCalledWith(1, 'tests', { id: 1, name: 'Daniel' })
      expect(Qb.insertOrReplace).toHaveBeenNthCalledWith(2, 'tests', { id: 2, name: 'Fernando' })
      expect(Qb.insertOrReplace).toHaveBeenNthCalledWith(3, 'tests', { id: 10, name: 'Lourusso' })
      expect(res).toEqual(expectedResponse)
    })
  })

  it('destroy', () => {
    const fn = jest.fn(() => Promise.resolve())
    databaseLayer.executeSql = fn
    const response = databaseLayer.destroy(1)
    expect(Qb.destroy).toBeCalledWith(tableName)
    expect(response).toBeInstanceOf(Promise)
    expect(fn).toBeCalledWith(qbMockReturns, [1])
  })

  it('destroyAll', () => {
    const fn = jest.fn(() => Promise.resolve())
    databaseLayer.executeSql = fn
    const response = databaseLayer.destroyAll()
    expect(Qb.destroyAll).toBeCalledWith(tableName)
    expect(response).toBeInstanceOf(Promise)
    expect(fn).toBeCalledWith(qbMockReturns)
  })

  it('find', () => {
    const fn = jest.fn(async () => ({ rows: [{ id: 1, teste1: 'Daniel', teste2: 3.5, teste3: '{"prop":123}' }] }))
    databaseLayer.executeSql = fn
    return databaseLayer.find(1).then(res => {
      expect(Qb.find).toBeCalledWith(tableName)
      expect(fn).toBeCalledWith(qbMockReturns, [1])
      expect(res).toEqual({ id: 1, teste1: 'Daniel', teste2: 3.5, teste3: '{"prop":123}' })
    })
  })

  it('find not found', () => {
    const fn = jest.fn(async () => ({ rows: [] }))
    databaseLayer.executeSql = fn
    return databaseLayer.find(1).then(res => {
      expect(Qb.find).toBeCalledWith(tableName)
      expect(fn).toBeCalledWith(qbMockReturns, [1])
      expect(res).toBeUndefined()
    })
  })

  describe('findBy', () => {
    it('with correct params returns first element found', () => {
      const fn = jest.fn(async () => ({ rows: [{ id: 1, teste1: 'Daniel', teste2: 3.5, teste3: '{"prop":123}' }] }))
      databaseLayer.executeSql = fn
      const where = { teste2: { equals: 3.5 } }
      return databaseLayer.findBy(where).then(res => {
        expect(Qb.query).toBeCalledWith(tableName, { where, limit: 1 })
        expect(fn).toBeCalledWith(qbMockReturns, Object.values(where).map(option => Object.values(option)).flat())
        expect(res).toEqual({ id: 1, teste1: 'Daniel', teste2: 3.5, teste3: '{"prop":123}' })
      })
    })

    it('without params returns the first row found', () => {
      const fn = jest.fn(async () => ({ rows: [{ id: 1, teste1: 'Daniel', teste2: 3.5, teste3: '{"prop":123}' }] }))
      databaseLayer.executeSql = fn
      return databaseLayer.findBy().then(res => {
        expect(Qb.query).toBeCalledWith(tableName, { where: {}, limit: 1 })
        expect(fn).toBeCalledWith(qbMockReturns, [])
        expect(res).toEqual({ id: 1, teste1: 'Daniel', teste2: 3.5, teste3: '{"prop":123}' })
      })
    })

    it('not found should return null', () => {
      const fn = jest.fn(async () => ({ rows: [] }))
      databaseLayer.executeSql = fn
      const where = { teste2_eq: 3.5 }
      return databaseLayer.findBy(where).then(res => {
        expect(Qb.query).toBeCalledWith(tableName, { where, limit: 1 })
        expect(fn).toBeCalledWith(qbMockReturns, Object.values(where).map(option => Object.values(option)).flat())
        expect(res).toBeUndefined()
      })
    })
  })

  it('query', () => {
    const fn = jest.fn(async () => ({ rows: [{ id: 1, teste3: '{"prop":123}' }] }))
    databaseLayer.executeSql = fn
    const options: IQueryOptions<ITests> = { columns: ['id', 'teste3'], where: { id: { equals: 1 } } }
    const params = Object.values(options.where || {}).map(option => Object.values(option)).flat()
    return databaseLayer.query(options).then(res => {
      expect(Qb.query).toBeCalledWith(tableName, options)
      expect(fn).toBeCalledWith(qbMockReturns, params)
      expect(res).toEqual([{ id: 1, teste3: '{"prop":123}' }])
    })
  })

  it('query with empty options', () => {
    const fn = jest.fn(async () => ({ rows: [{ id: 1, teste3: '{"prop":123}' }] }))
    databaseLayer.executeSql = fn
    return databaseLayer.query().then(res => {
      expect(Qb.query).toBeCalledWith(tableName, {})
      expect(fn).toBeCalledWith(qbMockReturns, [])
      expect(res).toEqual([{ id: 1, teste3: '{"prop":123}' }])
    })
  })
})
