import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryItem } from './entities/inventory-item.entity';

@Injectable()
export class InventoryItemsService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepository: Repository<InventoryItem>,
  ) {}

  create(createInventoryItemDto: CreateInventoryItemDto) {
    return 'This action adds a new inventoryItem';
  }

  findAll(): Promise<InventoryItem[]> {
    return this.inventoryItemsRepository.find({
      order: {
        condition: 'ASC',
      },
    });
  }

  findOne(itemId: string): Promise<InventoryItem | null> {
    return this.inventoryItemsRepository.findOneBy({ itemId });
  }

  update(id: number, updateInventoryItemDto: UpdateInventoryItemDto) {
    return `This action updates a #${id} inventoryItem`;
  }

  remove(id: number) {
    return `This action removes a #${id} inventoryItem`;
  }
}
