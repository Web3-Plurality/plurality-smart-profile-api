import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

interface ConnectedPlatform {
  platform_name: string;
  user_platform_id: string | null;
  username?: string | null;
}



@Entity()
export class SmartProfileMAP {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  profileTypeStreamId: string;

  @Column({ type: 'json', nullable: true })
  connectedPlatforms: ConnectedPlatform[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ type: 'varchar', nullable: true })
  avatar: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  bio: string;
}
