import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: "rsm_poc" })
export class RsmPoc {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({nullable: true})
  streamId: string;

  @Column({nullable: true, default:"Points"})
  incentiveType: string;

  @Column({nullable: true})
  logo: string;

  @Column({nullable: true})
  links: string;

  @Column({nullable: true})
  domains: string;
  
}