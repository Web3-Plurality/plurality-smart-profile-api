import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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
export class SmartProfileMapDev {
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
  userOnboardingMap: {
    clientAppId: string;
    onboardingData: Record<string, any>;
  };

}
