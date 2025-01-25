import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'client' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // profile type stream id
  @Column({ nullable: true })
  projectName: string;

  @Column({ nullable: false })
  email: string;

  @Column({ nullable: true })
  projectWebsite: string;
}
