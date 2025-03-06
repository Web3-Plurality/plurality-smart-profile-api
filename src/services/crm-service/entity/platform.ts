import { PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Entity } from "typeorm";

import { PlatformCategory } from "./platform-category";

@Entity('platforms')
export class Platform {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string; 

  @ManyToOne(() => PlatformCategory, category => category.platforms)
  @JoinColumn({ name: 'categoryId' })
  category: PlatformCategory;
}