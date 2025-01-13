// import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

// export enum AppType {
//   rsm = 'RSM',
//   login = 'login',
// }

// export enum IncentiveType {
//   points = 'POINTS',
//   stars = 'STARS',
// }

// @Entity({ name: 'client_apps' })
// export class ClientApp {
//   @PrimaryGeneratedColumn('uuid')
//   id!: string;

//   // profile type stream id
//   @Column({ nullable: true })
//   streamId: string;

//   @Column({ nullable: true })
//   logo: string;

//   @Column({ nullable: true })
//   links: string;

//   @Column({ nullable: true })
//   domains: string;

//   @Column({ nullable: true, default: IncentiveType.POITNS })
//   incentiveType: string;

//   @Column({default: AppType.login})
//   appType: string;

// @Column({default:""}) // update it to not null letter
//   clientSecret: string;
  

// }
