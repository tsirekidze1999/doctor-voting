#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2fd6940ed94d3dda54099330c9b36770ab0012d5f539ea867b81024c9e541c67/contract';
import endContract from '../../snapshots/2fd6940ed94d3dda54099330c9b36770ab0012d5f539ea867b81024c9e541c67/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fa1710363df6eb4bc906109f24e7f886875bb923ace4898708ec1b798dcf9eff/contract';
import startContract from '../../snapshots/fa1710363df6eb4bc906109f24e7f886875bb923ace4898708ec1b798dcf9eff/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'visitorSession',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'visitorSession',
        constraint: 'visitorSession_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'visitorSession',
        index: 'visitorSession_lastSeenAt_idx_b69845da',
        columns: ['lastSeenAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'visitorSession',
        index: 'visitorSession_startedAt_idx_cac56236',
        columns: ['startedAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
