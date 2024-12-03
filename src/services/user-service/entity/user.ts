import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';


export enum LoginType {
  stytch = 'STYTCH',
  google = 'GOOGLE',
  metamask='METAMASK',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: false, default: false })
  subscribe: boolean;

  @Column({ nullable: false, default: ""})
  loginType: string;

}
