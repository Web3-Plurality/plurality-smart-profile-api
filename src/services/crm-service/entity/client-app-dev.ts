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

@Entity({ name: 'client_apps_devs' })
export class ClientAppDev {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // profile type stream id
  @Column({ nullable: true })
  streamId: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  profileName: string;

  @Column({ nullable: true })
  profileDescription: string;

  @Column({ nullable: true })
  links: string;

  @Column({ nullable: true })
  domains: string;

  @Column({ nullable: true, default: IncentiveType.points })
  incentiveType: string;

  @Column({ default: AppType.login })
  appType: string;

  @Column({ nullable: false, default: '' })
  clientSecret: string;

  // Foreign key relationship with Client
  @ManyToOne(() => Client, (client) => client.apps, {
    nullable: true,
    onDelete: 'CASCADE', // Ensures cascade delete behavior
    onUpdate: 'CASCADE', // Updates foreign key if referenced key changes
  })
  @JoinColumn({ name: 'clientId' }) // Foreign key column name
  client: Client;
}
