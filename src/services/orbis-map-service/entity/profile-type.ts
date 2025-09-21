import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'orbis_profile_types' })
export class ProfileTypeOrbis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false })
  profileName: string;

  @Column({ nullable: false })
  description: string;

  @Column({ nullable: true, default: '' }) // we will see latter that if we can make this array of objects
  platforms: string;

  @Column({ nullable: true, default: '1.0' })
  version: string;
}
