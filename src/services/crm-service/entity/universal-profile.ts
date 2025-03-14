import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum UniversalProfileType {
  social = 'SOCIAL',
  gaming = 'GAMING',
  music = 'MUSIC',
  professional = 'PROFESSIONAL'
}

@Entity('universal_profiles')
export class UniversalProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: UniversalProfileType,
    unique: true
  })
  name: UniversalProfileType;

  @Column({ nullable: false })
  streamId: string;

} 