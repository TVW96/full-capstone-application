import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { User } from "../../users/entities/user.entity";
import { EntityImage } from "./entity-image.entity";

export enum MediaAssetStatus {
  PENDING = "pending",
  READY = "ready",
  FAILED = "failed",
}

export enum MediaAssetOriginType {
  USER_UPLOAD = "user_upload",
  EXTERNAL_IMPORT = "external_import",
  DERIVED = "derived",
  SYSTEM = "system",
  MIGRATION = "migration",
}

@Entity({ name: "media_assets" })
@Index(["bucket", "objectKey"], { unique: true })
@Index(["uploadedByUserId", "createdAt"])
@Check(
  "CHK_media_assets_origin_reference",
  'length(trim("origin_reference")) > 0',
)
@Check(
  "CHK_media_assets_current_location",
  'length(trim("storage_provider")) > 0 AND length(trim("bucket")) > 0 AND length(trim("object_key")) > 0',
)
@Check(
  "CHK_media_assets_derived_origin",
  '"origin_type" <> \'derived\' OR "derived_from_asset_id" IS NOT NULL',
)
export class MediaAsset {
  @PrimaryGeneratedColumn("uuid", { name: "asset_id" })
  assetId: string;

  @Column({ name: "uploaded_by_user_id", type: "uuid", nullable: true })
  uploadedByUserId: string | null;

  @ManyToOne(() => User, (user) => user.uploadedMediaAssets, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "uploaded_by_user_id" })
  uploadedByUser: User | null;

  @Column({
    name: "origin_type",
    type: "enum",
    enum: MediaAssetOriginType,
  })
  originType: MediaAssetOriginType;

  @Column({ name: "origin_reference", type: "varchar", length: 2048 })
  originReference: string;

  @Column({ name: "derived_from_asset_id", type: "uuid", nullable: true })
  derivedFromAssetId: string | null;

  @ManyToOne(() => MediaAsset, (asset) => asset.derivedAssets, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "derived_from_asset_id" })
  derivedFromAsset: MediaAsset | null;

  @OneToMany(() => MediaAsset, (asset) => asset.derivedFromAsset)
  derivedAssets: MediaAsset[];

  @Column({ name: "storage_provider", type: "varchar", length: 63 })
  storageProvider: string;

  @Column({ type: "varchar", length: 63 })
  bucket: string;

  @Column({ name: "object_key", type: "varchar", length: 1024 })
  objectKey: string;

  @Column({ name: "mime_type", type: "varchar", length: 100 })
  mimeType: string;

  // PostgreSQL bigint values are returned as strings by the pg driver.
  @Column({ name: "byte_size", type: "bigint" })
  byteSize: string;

  @Column({ type: "integer", nullable: true })
  width: number | null;

  @Column({ type: "integer", nullable: true })
  height: number | null;

  @Column({ name: "original_file_name", type: "varchar", length: 255 })
  originalFileName: string;

  @Column({ name: "source_url", type: "varchar", length: 2048, nullable: true })
  sourceUrl: string | null;

  @Column({
    type: "enum",
    enum: MediaAssetStatus,
    default: MediaAssetStatus.PENDING,
  })
  status: MediaAssetStatus;

  @OneToMany(() => EntityImage, (image) => image.asset)
  entityImages: EntityImage[];

  @OneToMany(() => User, (user) => user.avatarAsset)
  avatarForUsers: User[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
