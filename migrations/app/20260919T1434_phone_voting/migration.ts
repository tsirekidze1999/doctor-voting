#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/11c051a7358e3a09d6ac672a7f6b9eed13b962ce1e3da4ca9caf9b49f318a05c/contract';
import startContract from '../../snapshots/11c051a7358e3a09d6ac672a7f6b9eed13b962ce1e3da4ca9caf9b49f318a05c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c5c328fab2384da244ac029741fd80795f3cce08ec0e8902af2a46d4b89b116a/contract';
import endContract from '../../snapshots/c5c328fab2384da244ac029741fd80795f3cce08ec0e8902af2a46d4b89b116a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'verificationCode',
        column: col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'vote',
        column: col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'verificationCode', column: 'email' }),
      this.dropNotNull({ schema: 'public', table: 'vote', column: 'email' }),
      this.addUnique({
        schema: 'public',
        table: 'vote',
        constraint: 'vote_electionId_phone_key',
        columns: ['electionId', 'phone'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'verificationCode',
        index: 'verificationCode_phone_idx_8db23f45',
        columns: ['phone'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
