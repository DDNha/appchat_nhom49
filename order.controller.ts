import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseGuards, Req, UnauthorizedException, Res } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/authGuard';
import { getData } from 'src/product/interface';
import { Response } from 'express';

ApiTags('Order')
@Controller('api/Order') 
export class OrderController {
  constructor(private readonly orderService: OrderService) { }
  @Get('/getListOrder')
  async getListOrder(@Res() res: Response) {
    res.send({
      message: 'Xử lí thành công!',
      content: ((await this.orderService.getListOrder()).data)
    });
  }
  @Get('/getListOrderByUserID/:userId')
  async getListOrderByUserID(@Param('userId') userId: number, @Res() res: Response) {
    res.send({
      message: 'Xử lí thành công!',
      content: ((await this.orderService.getListOrderByUserID(+userId)).data)
    });
  }
  @Get('/getOrderById/:orderId')
  async getOrderById(@Param('orderId') orderId: number, @Res() res: Response) {
    res.send({
      message: 'Xử lí thành công!',
      content: ((await this.orderService.getOrderById(+orderId)).data)
    });
  }
  @Post('/createOrder')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createOrder(@Body() CreateOrderDto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(CreateOrderDto);
  }
  @Put('/UpdateOrder/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateOrder(
    @Param('id') id: string,
    @Body() body: UpdateOrderDto, @Req() req: getData
  ) {
    if (req.user.role === 'admin') {
      return this.orderService.updateOrder(+id, body);
    }
    throw new UnauthorizedException('Bạn không có quyền truy cập!');
  }
  @Delete('/DeleteOrder/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteOrder(@Param('id') id: string, @Req() req: getData
  ) {
    if (req.user.role === 'admin') {
      return this.orderService.deleteOrder(+id);
    }
    throw new UnauthorizedException('Bạn không có quyền truy cập!');
  }
}
