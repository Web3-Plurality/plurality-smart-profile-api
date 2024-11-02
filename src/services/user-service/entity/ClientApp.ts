import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum AppType {
  RSM = 'RSM',
  LOGIN = 'LOGIN',
}

export enum IncentiveType {
  POINTS = 'POINTS',
  STARS = 'STARS',
}

@Entity({ name: 'client_apps' })
export class ClientApp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // profile type stream id
  @Column({ nullable: true })
  streamId: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  links: string;

  @Column({ nullable: true })
  domains: string;

  @Column({ nullable: true, default: IncentiveType.POINTS })
  incentiveType: string;

  @Column({
    default: AppType.LOGIN,
  })
  appType: string;
}
