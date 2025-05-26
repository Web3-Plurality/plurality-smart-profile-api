import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('platforms')
export class Platform {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: false })
  isEnabled: boolean;
}
