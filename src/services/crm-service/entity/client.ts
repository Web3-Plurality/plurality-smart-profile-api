import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { ClientApp } from './client-app';
import { ClientAppDev } from './client-app-dev';
// import { ClientAppDev } from './client-app-dev';

@Entity({ name: 'clients' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false })
  email: string;

  // profile type stream id
  @Column({ nullable: true })
  projectName: string;

  @Column({ nullable: true })
  projectWebsite: string;
  // One-to-many relationship with ClientApp
  @OneToMany(() => ClientAppDev, (clientApp) => clientApp.client)
  apps: ClientApp[];
}
