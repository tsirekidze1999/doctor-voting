#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c5c328fab2384da244ac029741fd80795f3cce08ec0e8902af2a46d4b89b116a/contract';
import startContract from '../../snapshots/c5c328fab2384da244ac029741fd80795f3cce08ec0e8902af2a46d4b89b116a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e3b60adfc39007d3ccba955fffa642bf777aa279810be07ec85788b5b853ab1b/contract';
import endContract from '../../snapshots/e3b60adfc39007d3ccba955fffa642bf777aa279810be07ec85788b5b853ab1b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'vote',
        constraint: 'vote_electionId_email_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'vote',
        constraint: 'vote_electionId_phone_key',
      }),
      this.createTable({
        schema: 'public',
        table: 'category',
        columns: [
          col('electionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'candidate',
        column: col('categoryId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'vote',
        column: col('categoryId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'category',
        constraint: 'category_electionId_name_key',
        columns: ['electionId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vote',
        constraint: 'vote_electionId_categoryId_email_key',
        columns: ['electionId', 'categoryId', 'email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vote',
        constraint: 'vote_electionId_categoryId_phone_key',
        columns: ['electionId', 'categoryId', 'phone'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'candidate',
        index: 'candidate_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'category',
        index: 'category_electionId_idx_b4244a46',
        columns: ['electionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vote',
        index: 'vote_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'category',
        foreignKey: {
          name: 'category_electionId_fkey',
          columns: ['electionId'],
          references: { schema: 'public', table: 'election', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'candidate',
        foreignKey: {
          name: 'candidate_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'category', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vote',
        foreignKey: {
          name: 'vote_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'category', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
