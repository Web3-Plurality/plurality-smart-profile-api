import { Column, OneToMany, PrimaryGeneratedColumn, Entity } from "typeorm";
import { Platform } from "./platform";
import { ClientAppDev } from "./client-app-dev";

@Entity('platform_categories')
export class PlatformCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true, default: false })
  customCategory: boolean;

  @OneToMany(() => Platform, platform => platform.category)
  platforms: Platform[];

  @OneToMany(() => ClientAppDev, clientApp => clientApp.platformCategory)
  clientApps: ClientAppDev[];
}