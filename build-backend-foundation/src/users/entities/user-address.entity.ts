import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { User } from "./user.entity";

@Entity({ name: "user_addresses" })
export class UserAddress {
  @PrimaryGeneratedColumn("uuid", { name: "address_id" })
  addressId: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, (user) => user.addresses, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 60, default: "Address" })
  label: string;

  @Column({ name: "address_line_1", type: "varchar", length: 255 })
  addressLine1: string;

  @Column({
    name: "address_line_2",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  addressLine2: string | null;

  @Column({ type: "varchar", length: 100, default: "" })
  city: string;

  @Column({
    name: "administrative_area",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  administrativeArea: string | null;

  @Column({ name: "postal_code", type: "varchar", length: 24, default: "" })
  postalCode: string;

  @Column({ type: "varchar", length: 2 })
  country: string;

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
