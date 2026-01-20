import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ClientApp } from './client-app';

/**
 * Types of credit transactions
 */
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  DEDUCTION = 'DEDUCTION',
  REFUND = 'REFUND',
}

/**
 * Audit log for all credit transactions
 * Tracks deductions per attestation (deposits/withdrawals happen on-chain)
 *
 * Note: Credit balances are stored on-chain by clientId (bytes32).
 * This table only tracks transaction history for reporting purposes.
 */
@Entity({ name: 'credit_transactions' })
@Index(['clientAppId'])
@Index(['type'])
@Index(['createdAt'])
@Index(['attestationUID'])
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'clientAppId' })
  clientAppId!: string;

  @ManyToOne(() => ClientApp, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientAppId' })
  clientApp!: ClientApp;

  /**
   * Type of transaction
   */
  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  /**
   * Total amount of transaction in wei (gas + platform fee)
   */
  @Column({ type: 'decimal', precision: 78, scale: 0 })
  amountWei!: string;

  /**
   * Gas cost portion (for DEDUCTION transactions)
   * Includes: attestation gas + deduction tx gas
   */
  @Column({ type: 'decimal', precision: 78, scale: 0, nullable: true })
  gasCostWei!: string | null;

  /**
   * Platform fee portion - 10% of gas cost (for DEDUCTION transactions)
   */
  @Column({ type: 'decimal', precision: 78, scale: 0, nullable: true })
  platformFeeWei!: string | null;

  /**
   * On-chain transaction hash (for deductions)
   */
  @Column({ type: 'varchar', length: 66, nullable: true })
  txHash!: string | null;

  /**
   * Public attestation UID (for DEDUCTION transactions)
   */
  @Column({ type: 'varchar', length: 66, nullable: true })
  attestationUID!: string | null;

  /**
   * Private attestation UID (for DEDUCTION transactions)
   */
  @Column({ type: 'varchar', length: 66, nullable: true })
  privateAttestationUID!: string | null;

  /**
   * User who triggered the attestation (for DEDUCTION transactions)
   */
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  /**
   * Additional metadata as JSON string
   */
  @Column({ type: 'text', nullable: true })
  metadata!: string | null;

  /**
   * Balance after this transaction
   */
  @Column({ type: 'decimal', precision: 78, scale: 0, nullable: true })
  balanceAfterWei!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
