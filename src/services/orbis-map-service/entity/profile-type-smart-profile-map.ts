import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, PrimaryColumn } from 'typeorm';
import { SmartProfileOrbis } from './smart-profile';
import { ProfileTypeOrbis } from './profile-type';

@Entity({ name: 'profile_type_smart_profile_map' })
export class ProfileTypeSmartProfileMap {
  @PrimaryColumn()
  userDid!: string;

  @PrimaryColumn({ type: 'uuid' })
  profileTypeId!: string;

  // Foreign key to SmartProfile
  @Column({ type: 'uuid', nullable: false })
  smartProfileId: string;

  // Many-to-one relationship with SmartProfile
  @ManyToOne(() => SmartProfileOrbis)
  @JoinColumn({ name: 'smartProfileId' })
  smartProfile: SmartProfileOrbis;

  // Many-to-one relationship with ProfileType
  @ManyToOne(() => ProfileTypeOrbis)
  @JoinColumn({ name: 'profileTypeId' })
  profileType: ProfileTypeOrbis;

}
