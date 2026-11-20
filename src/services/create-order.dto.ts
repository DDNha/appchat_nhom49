import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class OrderProductDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  products_id: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  user_id: number;

  @ApiProperty()
  @IsNotEmpty()
  address: string;
  
  @ApiProperty({ type: [OrderProductDto] })
  @IsArray()
  @Type(() => OrderProductDto)
  orderProducts: OrderProductDto[];

  @ApiProperty()
  @IsInt()
  phiShip: number = 15000; 
}
