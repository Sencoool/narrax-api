import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const Hashpassword = createUserDto.password
      ? await argon2.hash(createUserDto.password)
      : null;

    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name ?? null,
        password: Hashpassword,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  createWithGoogle(email: string, name: string, googleId: string) {
    return this.prisma.user.create({
      data: {
        email,
        name,
        googleId,
      },
    });
  }

  linkGoogleId(userId: string, googleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { googleId },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        email: updateUserDto.email,
        name: updateUserDto.name ?? null,
      },
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: 'Invalid email or password' };
    }

    if (!user || !user.password) {
      return { error: 'Invalid email or password' };
    }

    const isValid = await argon2.verify(user.password, password);

    if (!isValid) {
      return { error: 'Invalid email or password' };
    }

    return { user };
  }
}
