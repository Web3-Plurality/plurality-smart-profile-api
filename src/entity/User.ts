import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({nullable: true})
  email: string;

  @Column({nullable: true})
  address: string;

  @Column({nullable: false, default: false})
  subscribe: string;
}