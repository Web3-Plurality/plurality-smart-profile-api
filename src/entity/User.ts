import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({nullable: true})
  email: string;

  @Column({nullable: true})
  address: string;

  @Column({nullable: false, default: false})
  subscribe: boolean;

  @Column({nullable: false, default: "https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png"})
  profileImg: string;

  @Column({nullable: false, default: ""})
  username: string;

  @Column({nullable: false, default: ""})
  bio: string;
}