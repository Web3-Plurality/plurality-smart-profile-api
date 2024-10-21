import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum AppType {
  RSM = "RSM",
  LOGIN = "LOGIN",
}


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


  @Column({
    type: "enum",
    enum: AppType,
    default: AppType.LOGIN, // Optional: set a default value if needed
  })
  appType: AppType;


  
}