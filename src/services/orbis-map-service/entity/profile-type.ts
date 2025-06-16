import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'profile_types_orbis' })
export class ProfileTypeOrbis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false })
  profileName: string;

  @Column({ nullable: false })
  description: string;

  @Column({ nullable: true, default: '' }) // we will see latter that if we can make this array of objess
  platforms: string;

  @Column({ nullable: true, default: '1.0' })
  version: string;
} 