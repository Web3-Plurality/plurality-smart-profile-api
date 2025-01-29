import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { ClientAppDev } from './client_app_dev';

@Entity({ name: 'client' })
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
  @OneToMany(() => ClientAppDev, (ClientAppDev) => ClientAppDev.client)
  apps: ClientAppDev[];
}
