# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.5] - 2026-03-03

### Fixed

- Serialize database operations per instance to prevent race conditions during `reset()` and `close()` operations. Operations are now queued sequentially, ensuring `deleteDatabaseAsync` is only called after all in-flight queries complete, fixing "Unable to delete database that is currently open" errors (Sentry issue CHECKPOINT-A-1C).

### Added

- Regression tests for in-flight operation handling during database reset
- Tests verifying concurrent `runSql` calls execute sequentially

## [3.0.4] - 2026-03-03

### Fixed

- Prevent database lock errors by using regular transactions instead of exclusive transactions for bulk operations. This fixes "database is locked" errors during concurrent sync operations.

### Changed

- `DatabaseLayer.executeSql()` now uses `runSql` directly instead of bulk execution path
- Bulk operations use `withTransactionAsync` instead of `withExclusiveTransactionAsync`

## [3.0.3] - 2026-02-28

### Fixed

- Use `withExclusiveTransactionAsync` for bulk SQL operations on native platforms to prevent "cannot rollback - no transaction is active" errors. Falls back to `withTransactionAsync` on web where exclusive transactions are not supported.

## [3.0.2] - 2026-02-28

### Added

- Added peer dependency support for `expo-sqlite` 16.x (Expo SDK 54).

### Changed

- Updated development dependency from `expo-sqlite` 15.x to 16.x.
- No runtime API changes: package remains on the async `expo-sqlite` implementation introduced in 3.0.0.

## [3.0.0] - 2025-02-27

### Breaking Changes

- **Migrated to Expo SQLite new API**: This version requires Expo SDK 51+ and uses the new `expo-sqlite` API. The legacy `expo-sqlite/legacy` API is no longer supported.
- **Peer dependency updated**: `expo-sqlite` peer dependency changed from `^14.0.3` to `^14.0.0 || ^15.0.0`
- **Database API changes**:
  - `Database.transaction()` method removed (replaced with internal `withTransactionAsync()`)
  - Database operations are now fully async-first

### Added

- Support for Expo SDK 52+ with new SQLite API
- `Database.withTransactionAsync()` method for executing custom transactions
- Improved type safety for `DatabaseLayer.executeBulkSql()` parameters
- Enhanced error handling in transaction callbacks
- Comprehensive test coverage for transaction error cases

### Changed

- **Database.ts**:
  - Migrated from `expo-sqlite/legacy` to `expo-sqlite`
  - `openDatabase()` → `openDatabaseAsync()` (async)
  - `transaction(callback)` → `withTransactionAsync()` (async)
  - `deleteAsync()` → `SQLite.deleteDatabaseAsync()` (static method)
  - All database operations now use async/await pattern
- **DatabaseLayer.ts**:
  - Updated to use `runAsync()` for INSERT/UPDATE/DELETE operations
  - Updated to use `getAllAsync()` for SELECT queries
  - Improved type safety for bulk SQL operations
- **Tests**:
  - Updated all mocks to use new expo-sqlite API
  - Added tests for `Database.reset()` functionality
  - Added tests for transaction error handling
  - Improved test coverage to ~90%

### Fixed

- Fixed unsafe non-null assertion in `withTransactionAsync()` that could cause runtime errors
- Improved error handling when transaction callbacks don't return values
- Fixed type safety issues in `executeBulkSql()` parameter handling

### Security

- All SQL queries continue to use parameterized statements to prevent SQL injection
- No security vulnerabilities introduced

### Migration Guide

If you're upgrading from version 2.x:

1. **Update Expo SDK**: Ensure you're using Expo SDK 51 or higher
2. **Update expo-sqlite**: Run `npx expo install expo-sqlite` to get the compatible version
3. **No code changes required**: The public API remains the same - only internal implementation changed
4. **Breaking change**: If you were directly using `Database.transaction()`, you'll need to use `Database.withTransactionAsync()` instead

### Technical Details

- Database connections are now lazy-loaded and cached using promises
- Transactions use `withTransactionAsync()` for atomic operations
- SQL statement detection improved for SELECT vs write operations
- All database operations properly handle async errors

## [2.3.1] - Previous Version

Previous version using Expo SDK 50 and legacy SQLite API.
