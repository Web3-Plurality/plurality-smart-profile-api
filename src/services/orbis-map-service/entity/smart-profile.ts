import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'orbis_smart_profiles' })
export class SmartProfileOrbis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true, default: '' })
  avatar: string;

  @Column({ nullable: true, default: '' })
  bio: string;

  @Column({ nullable: true, default: '' })
  scores: string;

  @Column({ nullable: true, default: '' })
  connectedPlatforms: string;

  @Column({ nullable: true, default: '' })
  profileTypeStreamId: string;

  @Column({ nullable: false, default: '2.0' })
  version: string;

  @Column({ nullable: true, default: '' })
  extendedPublicData: string;

  @Column({ nullable: true, default: '' })
  attestation: string;

  @Column({ nullable: true, default: '' })
  privateData: string;
}
