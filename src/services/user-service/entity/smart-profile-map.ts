import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClientAppDev } from '../../crm-service/entity/client-app-dev';
import { Client } from '../../crm-service/entity/client';

interface ConnectedProfiles {
  platformName: string;
  userPlatformId: string | null;
  username?: string | null;
}

interface Score {
  scoreType: string;
  scoreValue: number;
}

@Entity()
export class SmartProfileMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  profileTypeStreamId: string;

  @Column({ type: 'json', nullable: true })
  connectedProfiles: ConnectedProfiles[];

  @Column({ type: 'json', nullable: true })
  scores: Score[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ type: 'varchar', nullable: true })
  avatar: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  bio: string;
  
  @Column({ type: 'jsonb', nullable: true })
  onboardingData: Record<string, any>;

  // Foreign key relationship with Client
  @ManyToOne(() => ClientAppDev, (clientAppDev) => clientAppDev.smartProfileMaps, {
    nullable: true,
    onDelete: 'CASCADE', // Ensures cascade delete behavior
    onUpdate: 'CASCADE', // Updates foreign key if referenced key changes
  })
  @JoinColumn({ name: 'clientAppId' }) // Foreign key column name
  clientAppDev: ClientAppDev;
}
