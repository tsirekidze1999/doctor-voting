#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/11c051a7358e3a09d6ac672a7f6b9eed13b962ce1e3da4ca9caf9b49f318a05c/contract';
import endContract from '../../snapshots/11c051a7358e3a09d6ac672a7f6b9eed13b962ce1e3da4ca9caf9b49f318a05c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'candidate',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('electionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('firstName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('photoUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('specialty', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'election',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('endsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('startsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('winnerPublished', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'sponsor',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('electionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('logoUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('websiteUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'verificationCode',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('codeHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'vote',
        columns: [
          col('candidateId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('electionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vote',
        constraint: 'vote_electionId_email_key',
        columns: ['electionId', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'candidate',
        index: 'candidate_electionId_idx_b4244a46',
        columns: ['electionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sponsor',
        index: 'sponsor_electionId_idx_b4244a46',
        columns: ['electionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'verificationCode',
        index: 'verificationCode_email_idx_46df9cad',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'verificationCode',
        index: 'verificationCode_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vote',
        index: 'vote_candidateId_idx_462b5869',
        columns: ['candidateId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vote',
        index: 'vote_electionId_idx_b4244a46',
        columns: ['electionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'candidate',
        foreignKey: {
          name: 'candidate_electionId_fkey',
          columns: ['electionId'],
          references: { schema: 'public', table: 'election', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sponsor',
        foreignKey: {
          name: 'sponsor_electionId_fkey',
          columns: ['electionId'],
          references: { schema: 'public', table: 'election', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vote',
        foreignKey: {
          name: 'vote_electionId_fkey',
          columns: ['electionId'],
          references: { schema: 'public', table: 'election', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vote',
        foreignKey: {
          name: 'vote_candidateId_fkey',
          columns: ['candidateId'],
          references: { schema: 'public', table: 'candidate', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
