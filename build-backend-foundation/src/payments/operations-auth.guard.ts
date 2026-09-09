import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

import { User, UserRole } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";

export type OperationsRequest = Request & { marketplaceUser: User };

@Injectable()
export class OperationsAuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OperationsRequest>();
    const token =
      request.headers.authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
    const user = await this.users.requireAuthenticatedUser(token);
    if (user.role !== UserRole.OPERATIONS && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Operations access is required.");
    }
    request.marketplaceUser = user;
    return true;
  }
}
