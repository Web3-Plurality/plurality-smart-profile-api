import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'early_users' })
export class EarlyUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: false, default: false })
  subscribe: boolean;

  @Column({ nullable: false, default: '' })
  profileImg: string;

  @Column({ nullable: false, default: '' })
  username: string;
}
