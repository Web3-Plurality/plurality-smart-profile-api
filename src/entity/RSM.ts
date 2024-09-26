import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: "rsm_poc" })
export class RsmPoc {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({nullable: true})
  streamId: string;

  @Column({nullable: true})
  logo: string;

}