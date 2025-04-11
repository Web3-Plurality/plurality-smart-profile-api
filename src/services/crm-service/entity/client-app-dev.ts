import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client';

export enum AppType {
  rsm = 'RSM',
  login = 'LOGIN',
}

export enum IncentiveType {
  points = 'POINTS',
  stars = 'STARS',
}

export enum QuestionType {
  simpleQuestion = 'SIMPLE_QUESTION',
  multiChoiceQuestion = 'MULTICHOICE_QUESTION',
  categoryQuestion = 'CATEGORY_QUESTION',
}

@Entity({ name: 'client_apps_dev' })
export class ClientAppDev {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // profile type stream id
  @Column({ nullable: true })
  streamId: string;

  @Column({ type: 'jsonb', nullable: true, default: { light: '', dark: '' } })
  logos: {
    light: string;
    dark: string;
  };

  @Column({
    type: 'jsonb',
    nullable: true,
    default: {
      email: true,
      gmail: false,
      wallet: false,
    },
  })
  authentication: {
    email: boolean;
    gmail: boolean;
    wallet: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  onboardingConfig: {
    customOnboarding: boolean;
    questions: Array<{
      type: QuestionType;
      question: string;
      supportingText?: string;
      options?: Array<string>;
      tagGroups?: Array<{
        category: string;
        tags: Array<string>;
      }>;
    }>;
  };

  @Column({ nullable: true })
  links: string;

  @Column({ nullable: true })
  domains: string;

  @Column({ nullable: true, default: IncentiveType.points })
  incentiveType: string;

  @Column({ default: AppType.login })
  appType: string;

  @Column({ nullable: false, default: '' })
  clientAppSecret: string;

  @Column({ nullable: true, default: false })
  showRoulette: boolean;

  // Foreign key relationship with Client
  @ManyToOne(() => Client, (client) => client.apps, {
    nullable: true,
    onDelete: 'CASCADE', // Ensures cascade delete behavior
    onUpdate: 'CASCADE', // Updates foreign key if referenced key changes
  })
  @JoinColumn({ name: 'clientId' }) // Foreign key column name
  client: Client;
}
