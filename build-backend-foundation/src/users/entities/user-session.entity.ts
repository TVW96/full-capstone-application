import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { User } from "./user.entity";

@Entity({ name: "user_sessions" })
@Index(["expiresAt"])
export class UserSession {
  @PrimaryGeneratedColumn("uuid", {
    name: "session_id",
  })
  sessionId: string;

  @Column({
    name: "user_id",
    type: "uuid",
  })
  userId: string;

  @ManyToOne(() => User, (user) => user.sessions, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({
    name: "token_hash",
    type: "char",
    length: 64,
    unique: true,
    select: false,
  })
  tokenHash: string;

  @Column({
    name: "expires_at",
    type: "timestamptz",
  })
  expiresAt: Date;

  @CreateDateColumn({
    name: "created_at",
  })
  createdAt: Date;
}
