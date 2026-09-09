import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { Order } from "./order.entity";

export type VerificationLocationAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  administrativeArea: string;
  postalCode: string;
  country: string;
};

@Entity({ name: "verification_locations" })
export class VerificationLocation {
  @PrimaryGeneratedColumn("uuid", { name: "verification_location_id" })
  verificationLocationId!: string;

  @Column({ type: "varchar", length: 32, unique: true })
  code!: string;

  @Column({ type: "varchar", length: 160 })
  name!: string;

  @Column({ type: "jsonb" })
  address!: VerificationLocationAddress;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @OneToMany(() => Order, (order) => order.verificationLocation)
  orders!: Order[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
