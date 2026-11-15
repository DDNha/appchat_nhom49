import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Prisma, PrismaClient } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class OrderService {

  prisma = new PrismaClient();
  // Cho sẵn tọa độ tài xế hiện tại
  private driverLatitude: number = 10.88072665583552; // Tọa độ ban đầu của tài xế
  private driverLongitude: number = 106.78459883974683; // Tọa độ ban đầu của tài xế

  // Lấy thời gian đi từ vị trí tài xế hiện tại tới điểm đích
  async simulateTravelTime(latitude: number, longitude: number): Promise<string> {
    const estimatedTime = await this.getTravelTime(this.driverLatitude, this.driverLongitude, latitude, longitude);
    return estimatedTime;
  }

  // Hàm di chuyển tài xế từng bước về phía địa chỉ đích
  private moveDriverTowardsDestination(destinationLatitude: number, destinationLongitude: number) {
    const latDiff = destinationLatitude - this.driverLatitude;
    const lonDiff = destinationLongitude - this.driverLongitude;

    // Di chuyển 1% quãng đường mỗi lần cập nhật
    this.driverLatitude += latDiff * 0.01;  // Di chuyển 1% quãng đường về phía latitude đích
    this.driverLongitude += lonDiff * 0.01; // Di chuyển 1% quãng đường về phía longitude đích
  }

  // Hàm khởi động di chuyển tài xế tự động mỗi giây
  private startSimulatedDriverMovement(orderId: number, destinationLatitude: number, destinationLongitude: number) {
    // Tính khoảng cách ban đầu và ước tính thời gian di chuyển
    const latDiff = destinationLatitude - this.driverLatitude;
    const lonDiff = destinationLongitude - this.driverLongitude;

    // Nếu đã đến đích, dừng lại
    const interval = setInterval(async () => {
      this.moveDriverTowardsDestination(destinationLatitude, destinationLongitude);

      // Kiểm tra xem tài xế đã đến đích chưa
      if (Math.abs(this.driverLatitude - destinationLatitude) < 0.0001 && Math.abs(this.driverLongitude - destinationLongitude) < 0.0001) {
        clearInterval(interval); // Dừng lại khi đã đến đích
        console.log('Tài xế đã đến đích!');
        await this.updateOrderStatus(orderId, 'Hoàn thành');  // Cập nhật trạng thái đơn hàng thành "Hoàn thành"
      }

      // Cập nhật thời gian khi tài xế di chuyển
      const estimatedTime = await this.simulateTravelTime(destinationLatitude, destinationLongitude);
      await this.updateOrderTime(orderId, estimatedTime);
    }, 1000);  // Di chuyển mỗi giây (1000ms)
  }

  // Cập nhật thời gian đơn hàng trong cơ sở dữ liệu
  private async updateOrderTime(orderId: number, estimatedTime: string) {
    await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        thoiGian: estimatedTime,  // Cập nhật thời gian dự kiến
      },
    });
    console.log(`Thời gian đã được cập nhật thành: ${estimatedTime}`);
  }

  private async updateOrderStatus(orderId: number, status: string) {
    await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: status,  // Cập nhật trạng thái thành "Hoàn thành"
      },
    });
    console.log(`Trạng thái đơn hàng đã được cập nhật thành: ${status}`);
  }
  async getListOrder() {
    try {
      const data = await this.prisma.order.findMany({
        include: {
          User: {
            select: {
              user_fullname: true,
              user_phone: true,
            },
          },
          OrderProduct: {
            select: {
              quantity: true,
              Product: {
                select: {
                  products_id: true,
                  products_name: true,
                  products_price: true,
                  products_image: true,
                },
              },
            },
          },
        },
      });

      return { data };
    } catch (err) {
      throw new Error(`Error getting users: ${err}`);
    }
  }
  async getListOrderByUserID(userId: number) {
    try {
      const data = await this.prisma.order.findMany({
        where: {
          user_id: userId,
        },
        include: {
          User: {
            select: {
              user_fullname: true,
              user_phone: true,
            },
          },
          OrderProduct: {
            select: {
              quantity: true,
              Product: {
                select: {

                  products_name: true,
                  products_price: true,
                  products_image: true,
                },
              },
            },
          },
        },
      });

      return { data };
    } catch (err) {
      throw new Error(`Error getting orders by userId: ${err}`);
    }
  }

  async getOrderById(orderId: number) {
    try {
      const data = await this.prisma.order.findUnique({
        where: {
          order_id: orderId,
        },
        include: {
          User: {
            select: {
              user_fullname: true,
              user_phone: true,
            },
          },
          OrderProduct: {
            select: {
              quantity: true,
              Product: {
                select: {
                  products_id: true,
                  products_name: true,
                  products_price: true,
                  products_image: true,
                },
              },
            },
          },
        },
      });

      if (!data) {
        throw new Error(`Order with id ${orderId} not found`);
      }

      return { data };
    } catch (err) {
      throw new Error(`Error getting order: ${err}`);
    }
  }
  async createOrder(body: CreateOrderDto) {
    const { user_id, address, orderProducts, phiShip = 15000 } = body;
    if (!address) {
      throw new Error('Không tìm thấy địa chỉ');
    }
    // Tạo địa chỉ đầy đủ từ các trường của bảng Address
    // Lấy tọa độ từ địa chỉ
    const { latitude, longitude } = await this.getCoordinates(address);

    // Tính thời gian di chuyển từ vị trí của bạn đến địa chỉ đích
    const estimatedTime = await this.getTravelTime(this.driverLatitude, this.driverLongitude, latitude, longitude);

    let totalAmount = 0;
    // Lấy thông tin giá của các sản phẩm trong order
    for (const orderProduct of orderProducts) {
      const product = await this.prisma.product.findUnique({
        where: { products_id: orderProduct.products_id },
      });

      if (product && product.products_price) {
        totalAmount += product.products_price * orderProduct.quantity;
      }
    }
    const order = await this.prisma.order.create({
      data: {
        user_id,
        address,
        status: 'Đang xử lí',
        phiShip,
        thoiGian: estimatedTime,
        totalAmount: totalAmount + phiShip,
        OrderProduct: {
          create: orderProducts.map((item) => ({
            quantity: item.quantity,
            products_id: item.products_id,
          })),
        },
      },
    });
    return order;
  }
  async updateOrder(id: number, body: UpdateOrderDto) {
    const { status, address, orderProducts } = body;

    const existingOrder = await this.prisma.order.findUnique({
      where: { order_id: id },
      include: { OrderProduct: true },
    });

    if (!existingOrder) {
      throw new Error('Order not found');
    }

    let updatedTime = existingOrder.thoiGian;

    // Trường hợp cập nhật trạng thái giao hàng và địa chỉ
    if (status === 'Đang giao hàng') {
      if (address) {
        const { latitude, longitude } = await this.getCoordinates(address);

        // Tính toán và bắt đầu di chuyển tài xế
        this.startSimulatedDriverMovement(id, latitude, longitude);

        // Tính thời gian di chuyển
        updatedTime = await this.simulateTravelTime(latitude, longitude);
      }
    }

    // Trường hợp nếu có sản phẩm mới thì cập nhật tổng tiền
    let totalAmount = existingOrder.totalAmount || 0;
    if (orderProducts && orderProducts.length > 0) {
      totalAmount = 0;
      for (const orderProduct of orderProducts) {
        const product = await this.prisma.product.findUnique({
          where: { products_id: orderProduct.products_id },
        });

        if (product && product.products_price) {
          totalAmount += product.products_price * orderProduct.quantity;
        }
      }
    }

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: id },
      data: {
        status,
        address,
        thoiGian: updatedTime,
        totalAmount,
        OrderProduct: orderProducts
          ? {
            deleteMany: {},
            create: orderProducts.map((item) => ({
              products_id: item.products_id,
              quantity: item.quantity,
            })),
          }
          : undefined,
      },
    });

    return updatedOrder;
  }

  async deleteOrder(id: number) {
    try {
      const deletedOrder = await this.prisma.order.delete({
        where: { order_id: id },
      });

      return {
        message: 'Order deleted successfully',
        deletedOrder,
      };
    } catch (error) {
      throw new Error(`Error deleting order: ${error.message}`);
    }
  }

  // Lấy vị trí địa lý (latitude & longitude) từ địa chỉ được truyền vào.
  async getCoordinates(address: string): Promise<{ latitude: number, longitude: number }> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`;

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'back-end/0.0.1 (hoangquy4874@gmail.com)',
        },
      });
      const data = response.data;

      if (data && data.length > 0) {
        return { latitude: data[0].lat, longitude: data[0].lon };
      } else {
        throw new Error('Không tìm thấy kết quả cho địa chỉ này');
      }
    } catch (error) {
      throw new Error(`Lỗi khi gọi Nominatim API: ${error.message}`);
    }
  }
  // Tính thời gian di chuyển giữa hai vị trí.
  async getTravelTime(startLat: number, startLon: number, endLat: number, endLon: number): Promise<string> {
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false&geometries=geojson`;

    try {
      // Gửi yêu cầu đến API của OSRM
      const response = await axios.get(osrmUrl);

      // Lấy thời gian từ response, tính toán theo giây
      const duration = response.data.routes[0].duration;  // Thời gian di chuyển tính bằng giây

      // Chuyển đổi thời gian sang phút và giây
      const minutes = Math.floor(duration / 60);  // Chuyển từ giây sang phút
      const seconds = Math.floor(duration % 60);

      return `${minutes} phút ${seconds} giây`;
    } catch (error) {
      console.error('Lỗi khi tính toán thời gian di chuyển:', error);
      throw new Error('Không thể tính toán thời gian di chuyển');
    }
  }
}
