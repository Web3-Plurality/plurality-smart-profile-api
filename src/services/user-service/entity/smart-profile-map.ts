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

  @Column({ type: 'varchar', length: 3000, nullable: true })
  bio: string;

  @Column({ type: 'jsonb', nullable: true })
  userOnboardingMap: {
    clientAppId: string;
    onboardingData: Record<string, any>;
  };

  @Column({ type: 'varchar', length: 66, nullable: true })
  onchainAttestationUID?: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  privateAttestationUID?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  attestationChain?: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  attestationTxHash?: string;

  @Column({ type: 'bigint', nullable: true })
  attestationTimestamp?: number;

  @Column({ type: 'text', nullable: true })
  encryptedPrivateData?: string;
}
