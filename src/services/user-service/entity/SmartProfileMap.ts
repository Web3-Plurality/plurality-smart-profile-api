import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

interface ConnectedProfiles {
  platform_name: string;
  user_platform_id: string | null;
  username?: string | null;
}

interface Score {
  score_type: string;
  score_value: number;
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
}
