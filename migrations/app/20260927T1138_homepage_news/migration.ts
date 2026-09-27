#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/19a61c9cc62433eba30c0b1970410989ed89766ac7824c1ec8abc6a1de287f2b/contract';
import endContract from '../../snapshots/19a61c9cc62433eba30c0b1970410989ed89766ac7824c1ec8abc6a1de287f2b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/da173946ef595894548e79227aef9ad34ea5f13a129fe6849633c50f23525425/contract';
import startContract from '../../snapshots/da173946ef595894548e79227aef9ad34ea5f13a129fe6849633c50f23525425/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'newsSettings',
        columns: [
          col('enabled', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'newsSlide',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('photoUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
