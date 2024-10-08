import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: "rsm_apps" })
export class RsmApp {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({nullable: true})
  streamId: string;

  @Column({nullable: true})
  logo: string;

  @Column({nullable: true})
  links: string;

  @Column({nullable: true})
  domains: string;

  @Column({nullable: true, default:"Points"})
  incentiveType: string;
  
}