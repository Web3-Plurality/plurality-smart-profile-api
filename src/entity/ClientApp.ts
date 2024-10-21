import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: "client_apps" })
export class ClientApp  {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // profile type stream id
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