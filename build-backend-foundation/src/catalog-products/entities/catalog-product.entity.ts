import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { EntityImage } from "../../media/entities/entity-image.entity";

@Entity({ name: "catalog_products" })
export class CatalogProduct {
  @PrimaryGeneratedColumn("uuid", {
    name: "product_id",
  })
  productId!: string;

  @Column({
    type: "varchar",
    length: 160,
  })
  title!: string;

  @Column({
    type: "varchar",
    length: 160,
    nullable: true,
  })
  series!: string | null;

  @Column({
    name: "volume_number",
    type: "integer",
    nullable: true,
  })
  volumeNumber!: number | null;

  @Column({
    type: "varchar",
    length: 80,
    nullable: true,
  })
  edition!: string | null;

  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
  })
  isbn!: string | null;

  @Column({
    type: "varchar",
    length: 160,
    nullable: true,
  })
  author!: string | null;

  @Column({
    type: "varchar",
    length: 160,
    nullable: true,
  })
  publisher!: string | null;

  @Column({
    type: "varchar",
    length: 10,
    nullable: true,
  })
  language!: string | null;

  @Column({
    name: "publication_date",
    type: "date",
    nullable: true,
  })
  publicationDate!: Date | null;

  @OneToMany(() => EntityImage, (image) => image.catalogProduct)
  images!: EntityImage[];
}
